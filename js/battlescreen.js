/* Clash of Critters — battlescreen.js
 * Owns the battle: the fixed-timestep loop, the HUD, and all pointer/keyboard
 * input for placing cards.
 */
window.COC = window.COC || {};
(function (NS) {
  'use strict';

  const U = NS.U;
  const $ = U.$, $$ = U.$$;
  const Cards = NS.Cards;
  const Render = NS.Render;
  const Audio = NS.Audio;
  const ARENA = NS.ARENA;

  const BS = {
    battle: null,
    ai: null,
    info: null,
    running: false,
    paused: false,
    raf: null,
    acc: 0,
    last: 0,
    speed: 1,
    view: { dragging: null, cursor: null },
    handEls: [],
    selected: -1,
    _handIds: [],
  };

  const EMOTES = ['😺', '😹', '😾', '👑', '🔥', '💤', '👏', '🤝'];

  // --------------------------------------------------------------- setup
  BS.init = function () {
    const canvas = $('#arena');
    Render.attach(canvas);

    // hand slots
    const hand = $('#hand');
    hand.innerHTML = '';
    BS.handEls = [];
    for (let i = 0; i < 4; i++) {
      const slot = U.el('div', 'card-slot');
      slot.dataset.slot = String(i);
      hand.appendChild(slot);
      BS.handEls.push(slot);
    }

    window.addEventListener('resize', BS.resize);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', BS.resize);
    /* The card bar's height depends on content that renders after the first
     * layout pass, so a one-shot measurement gives the canvas the wrong size
     * and the arena ends up cropped. Watch the container instead. */
    if (window.ResizeObserver) {
      new ResizeObserver(() => BS.resize()).observe($('#arena-wrap'));
    }

    BS.bindInput();

    $('#btn-quit').addEventListener('click', () => {
      if (!BS.battle || BS.battle.phase === 'ended') { NS.Game.show('menu'); return; }
      BS.paused = true;
      NS.Game.overlay('pause');
      Audio.play('back');
    });

    const picker = $('#emote-picker');
    EMOTES.forEach((e) => {
      const b = U.el('button', null, e);
      b.addEventListener('click', () => {
        BS.showEmote('player', e);
        picker.classList.add('hidden');
      });
      picker.appendChild(b);
    });
    $('#btn-emote').addEventListener('click', () => {
      picker.classList.toggle('hidden');
      Audio.play('select');
    });
  };

  BS.resize = function () {
    if (!Render.canvas) return;
    const wrap = $('#arena-wrap');
    const r = wrap.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    Render.resize(Math.floor(r.width), Math.floor(r.height));
  };

  // --------------------------------------------------------------- start
  BS.start = function (opts) {
    opts = opts || {};
    const save = NS.Game.save;
    const difficulty = opts.difficulty || NS.Game.difficultyFor(save.trophies);
    const deckDef = opts.enemyDeck
      ? { name: opts.enemyName || 'Rival', cards: opts.enemyDeck }
      : Cards.AI_DECKS[(Math.random() * Cards.AI_DECKS.length) | 0];

    const seed = (Math.random() * 1e9) | 0;
    BS.battle = new NS.Battle({
      seed,
      playerDeck: save.deck.slice(),
      enemyDeck: deckDef.cards.slice(),
      practice: !!opts.practice,
      infiniteElixir: !!opts.infiniteElixir,
    });
    BS.ai = new NS.AI(BS.battle, difficulty, seed);
    BS.info = {
      practice: !!opts.practice,
      difficulty,
      enemyName: NS.AI_DIFFICULTY[difficulty].label,
      deckName: deckDef.name,
    };
    BS.speed = opts.speed || 1;
    BS.selected = -1;
    BS.view.dragging = null;
    BS.view.cursor = null;
    BS._handIds = ['', '', '', ''];
    BS._lastCrowns = { player: 0, enemy: 0 };
    BS._resultShown = false;
    BS.paused = false;

    NS.Game.show('battle');
    NS.Game.hideOverlay('result');
    NS.Game.hideOverlay('pause');
    $('#emote-picker').classList.add('hidden');
    $('#emote-layer').innerHTML = '';

    // fill the card bar first so the arena is measured against its real height
    requestAnimationFrame(() => {
      BS.renderHand(true);
      BS.updateHud();
      BS.resize();
    });

    Audio.unlock();
    Audio.startMusic(112);
    BS.running = true;
    BS.last = performance.now();
    BS.acc = 0;
    cancelAnimationFrame(BS.raf);
    BS.raf = requestAnimationFrame(BS.frame);
  };

  BS.stop = function () {
    BS.running = false;
    cancelAnimationFrame(BS.raf);
    Audio.stopMusic();
  };

  // --------------------------------------------------------------- loop
  const STEP = 1 / 60;
  BS.frame = function (now) {
    if (!BS.running) return;
    BS.raf = requestAnimationFrame(BS.frame);
    let dt = (now - BS.last) / 1000;
    BS.last = now;
    if (dt > 0.25) dt = 0.25;           // tab was backgrounded — do not fast-forward

    const b = BS.battle;
    if (!b) return;

    if (!BS.paused) {
      BS.acc += dt * BS.speed;
      let steps = 0;
      while (BS.acc >= STEP && steps < 8) {
        b.update(STEP);
        if (BS.ai) BS.ai.update(STEP);
        BS.acc -= STEP;
        steps++;
        BS.watchEvents();
      }
    }

    Render.draw(b, BS.view);
    BS.updateHud();

    if (b.phase === 'ended' && !BS._resultShown) {
      BS._resultShown = true;
      setTimeout(BS.showResult, 1100);
    }
  };

  // Watch for state changes worth announcing.
  BS.watchEvents = function () {
    const b = BS.battle;
    if (b.phase === 'countdown') {
      const n = Math.ceil(b.countdown);
      if (n !== BS._cd) {
        BS._cd = n;
        if (n > 0) { BS.banner(String(n)); Audio.play('countdown'); }
      }
      return;
    }
    if (BS._cd !== 0) { BS._cd = 0; BS.banner('GO!'); }

    ['player', 'enemy'].forEach((team) => {
      const c = b.sides[team].crowns;
      if (c > BS._lastCrowns[team]) {
        BS._lastCrowns[team] = c;
        Render.shake = 1.2;
        if (b.phase !== 'ended') {
          BS.banner(team === 'player' ? 'Tower down!' : 'Tower lost!');
          Audio.vibrate(team === 'player' ? [40, 60, 40] : [90]);
          // the AI gloats when it takes a tower
          if (team === 'enemy') setTimeout(() => BS.showEmote('enemy', '😹'), 500);
        }
      }
    });

    if (b.elixirMult === 2 && !BS._doubleShown) {
      BS._doubleShown = true;
      BS.banner('Double elixir!');
    }
    if (b.phase === 'overtime' && !BS._otShown) {
      BS._otShown = true;
      BS.banner('Overtime!');
    }
  };

  // --------------------------------------------------------------- hud
  BS.banner = function (text) {
    const el = $('#battle-banner');
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;   // restart the animation
    el.classList.add('show');
  };

  BS.showEmote = function (team, emoji) {
    const layer = $('#emote-layer');
    const b = U.el('div', 'emote-bubble', emoji);
    const r = layer.getBoundingClientRect();
    b.style.left = (r.width * (0.3 + Math.random() * 0.4)) + 'px';
    b.style.top = (team === 'player' ? r.height * 0.68 : r.height * 0.22) + 'px';
    layer.appendChild(b);
    setTimeout(() => b.remove(), 2100);
    Audio.play('emote');
  };

  BS.updateHud = function () {
    const b = BS.battle;
    if (!b) return;
    const side = b.sides.player;

    // elixir
    const el = Math.floor(side.elixir);
    const frac = side.elixir / 10;
    $('#elixir-fill').style.width = (frac * 100) + '%';
    $('#elixir-count').textContent = b.infiniteElixir ? '∞' : String(el);
    $('#elixir-bar').classList.toggle('boost', b.elixirMult > 1);

    // clock
    const clock = $('#clock-time');
    const label = $('#clock-label');
    const wrap = clock.parentElement;
    if (b.phase === 'countdown') {
      clock.textContent = U.fmtTime(b.clock);
      label.textContent = 'Get ready';
    } else {
      clock.textContent = U.fmtTime(b.clock);
      label.textContent = b.phase === 'overtime' ? 'Sudden death' : 'Time left';
    }
    wrap.classList.toggle('urgent', b.clock <= 20 && b.phase !== 'ended');
    wrap.classList.toggle('overtime', b.phase === 'overtime');

    // crowns
    ['player', 'enemy'].forEach((team) => {
      const row = $('#crowns-' + team);
      if (row.children.length !== 3) {
        row.innerHTML = '';
        for (let i = 0; i < 3; i++) row.appendChild(U.el('div', 'crown', '👑'));
      }
      const n = b.sides[team].crowns;
      Array.from(row.children).forEach((c, i) => c.classList.toggle('on', i < n));
    });

    BS.renderHand(false);
  };

  BS.renderHand = function (force) {
    const b = BS.battle;
    if (!b) return;
    const side = b.sides.player;
    const el = Math.floor(side.elixir);

    side.hand.forEach((id, i) => {
      const slot = BS.handEls[i];
      if (force || BS._handIds[i] !== id) {
        BS._handIds[i] = id;
        slot.innerHTML = '';
        const card = NS.Game.cardEl(Cards.get(id), { size: 120 });
        card.dataset.slot = String(i);
        slot.appendChild(card);
        if (!force) {
          card.animate(
            [{ transform: 'translateY(26px) scale(.85)', opacity: 0 }, { transform: 'none', opacity: 1 }],
            { duration: 260, easing: 'cubic-bezier(.2,1.3,.5,1)' }
          );
        }
      }
      const card = slot.firstChild;
      if (!card) return;
      const cost = Cards.get(id).cost;
      const affordable = b.infiniteElixir || el >= cost;
      card.classList.toggle('disabled', !affordable);
      card.classList.toggle('selected', BS.selected === i);
      card.classList.toggle('dragging', !!(BS.view.dragging && BS.view.dragging.slot === i));
    });

    // next card preview
    const nextId = side.queue[0];
    const nc = $('#next-card');
    if (nc.dataset.card !== nextId) {
      nc.dataset.card = nextId;
      nc.innerHTML = '';
      nc.appendChild(NS.Game.cardEl(Cards.get(nextId), { size: 70, noName: true }));
    }
  };

  // --------------------------------------------------------------- input
  let ghost = null;
  let pointerStart = null;

  function makeGhost(card) {
    removeGhost();
    ghost = NS.Game.cardEl(card, { size: 110, noName: true });
    ghost.id = 'drag-ghost';
    document.body.appendChild(ghost);
  }
  function removeGhost() {
    if (ghost) { ghost.remove(); ghost = null; }
  }

  function arenaPointFromEvent(ev) {
    const canvas = Render.canvas;
    const r = canvas.getBoundingClientRect();
    const px = ev.clientX - r.left;
    const py = ev.clientY - r.top;
    if (px < -40 || py < -40 || px > r.width + 40 || py > r.height + 40) return null;
    const w = Render.toWorld(px, py);
    return {
      x: U.clamp(w.x, 0.4, ARENA.w - 0.4),
      y: U.clamp(w.y, 0.4, ARENA.h - 0.4),
      inside: px >= 0 && py >= 0 && px <= r.width && py <= r.height,
    };
  }

  BS.bindInput = function () {
    const hand = $('#hand');

    hand.addEventListener('pointerdown', (ev) => {
      const cardEl = ev.target.closest('.card');
      if (!cardEl) return;
      const slot = parseInt(cardEl.dataset.slot, 10);
      const b = BS.battle;
      if (!b || b.phase === 'ended') return;
      const id = b.sides.player.hand[slot];
      const card = Cards.get(id);
      ev.preventDefault();
      pointerStart = { x: ev.clientX, y: ev.clientY, slot, moved: false, id: ev.pointerId };
      BS.view.dragging = { slot, card };
      BS.selected = slot;
      makeGhost(card);
      ghost.style.left = ev.clientX + 'px';
      ghost.style.top = ev.clientY + 'px';
      Audio.unlock();
      Audio.play('select');
    });

    window.addEventListener('pointermove', (ev) => {
      if (!pointerStart || !BS.view.dragging) return;
      const dx = ev.clientX - pointerStart.x;
      const dy = ev.clientY - pointerStart.y;
      if (Math.hypot(dx, dy) > 6) pointerStart.moved = true;
      if (ghost) {
        ghost.style.left = ev.clientX + 'px';
        ghost.style.top = ev.clientY + 'px';
      }
      const p = arenaPointFromEvent(ev);
      BS.view.cursor = p && p.inside ? p : null;
    }, { passive: true });

    window.addEventListener('pointerup', (ev) => {
      if (!pointerStart) return;
      const start = pointerStart;
      pointerStart = null;
      removeGhost();

      const p = arenaPointFromEvent(ev);
      const droppedOnArena = p && p.inside;

      if (start.moved && droppedOnArena) {
        BS.tryPlay(start.slot, p.x, p.y);
        BS.view.dragging = null;
        BS.view.cursor = null;
        BS.selected = -1;
      } else if (start.moved) {
        // dragged off the board — cancel
        BS.view.dragging = null;
        BS.view.cursor = null;
        BS.selected = -1;
      } else {
        // a tap: keep the card selected so the next tap places it
        BS.view.dragging = null;
        BS.view.cursor = null;
        BS.selected = start.slot;
      }
      BS.renderHand(false);
    });

    window.addEventListener('pointercancel', () => {
      pointerStart = null;
      removeGhost();
      BS.view.dragging = null;
      BS.view.cursor = null;
    });

    // tap-to-place on the arena
    Render.canvas.addEventListener('pointerdown', (ev) => {
      if (BS.selected < 0 || pointerStart) return;
      const p = arenaPointFromEvent(ev);
      if (!p || !p.inside) return;
      ev.preventDefault();
      BS.tryPlay(BS.selected, p.x, p.y);
      BS.selected = -1;
      BS.renderHand(false);
    });

    // show the drop zone while a card is merely selected
    Render.canvas.addEventListener('pointermove', (ev) => {
      if (BS.selected < 0 || pointerStart) return;
      const b = BS.battle;
      if (!b) return;
      const p = arenaPointFromEvent(ev);
      if (!p) return;
      BS.view.dragging = { slot: BS.selected, card: Cards.get(b.sides.player.hand[BS.selected]) };
      BS.view.cursor = p.inside ? p : null;
    }, { passive: true });

    Render.canvas.addEventListener('pointerleave', () => {
      if (!pointerStart) BS.view.cursor = null;
    });

    // keyboard
    window.addEventListener('keydown', (ev) => {
      if (NS.Game.screen !== 'battle') return;
      if (ev.key >= '1' && ev.key <= '4') {
        BS.selected = parseInt(ev.key, 10) - 1;
        const b = BS.battle;
        BS.view.dragging = { slot: BS.selected, card: Cards.get(b.sides.player.hand[BS.selected]) };
        BS.renderHand(false);
        Audio.play('select');
      } else if (ev.key === 'Escape') {
        BS.selected = -1;
        BS.view.dragging = null;
        BS.view.cursor = null;
        BS.renderHand(false);
      } else if (ev.key === ' ' && BS.info && BS.info.practice) {
        ev.preventDefault();
        BS.paused = !BS.paused;
        NS.Game.toast(BS.paused ? 'Paused' : 'Resumed');
      }
    });
  };

  BS.tryPlay = function (slot, x, y) {
    const b = BS.battle;
    if (!b) return;
    const id = b.sides.player.hand[slot];
    const r = b.play('player', slot, x, y);
    if (r.ok) {
      Audio.play('deploy');
      Audio.vibrate(18);
      BS.renderHand(false);
    } else {
      Audio.play('error');
      const why = r.why === 'not enough elixir' ? 'Not enough elixir'
        : r.why === 'enemy territory' ? 'You can only deploy on your side'
          : r.why === 'in the river' ? 'Not in the river'
            : r.why === 'too close to a tower' ? 'Too close to a tower'
              : 'Cannot place there';
      NS.Game.toast(why);
    }
  };

  // --------------------------------------------------------------- result
  BS.showResult = function () {
    const b = BS.battle;
    const r = b.result;
    const info = NS.Game.recordResult(b, BS.info);
    BS.stop();

    const won = r.winner === 'player';
    const drew = !r.winner;
    const title = $('#result-title');
    title.textContent = won ? 'Victory!' : drew ? 'Draw' : 'Defeat';
    title.className = won ? 'win' : drew ? '' : 'lose';
    Audio.play(won ? 'win' : drew ? 'draw' : 'lose');
    Audio.vibrate(won ? [60, 40, 60, 40, 120] : [200]);

    $('#result-crowns-player').textContent = r.crowns.player;
    $('#result-crowns-enemy').textContent = r.crowns.enemy;
    $('#result-enemy-name').textContent = info.enemyName;

    const td = $('#result-trophies');
    if (info.practice) {
      td.textContent = 'Practice battle — no trophies';
      td.className = 'trophy-delta';
    } else {
      const d = info.delta;
      td.textContent = (d > 0 ? '+' : '') + d + ' 🏆   ·   ' + NS.Game.save.trophies + ' total';
      td.className = 'trophy-delta ' + (d > 0 ? 'up' : d < 0 ? 'down' : '');
    }

    const ul = $('#result-stats');
    ul.innerHTML = '';
    const row = (k, v) => {
      const li = U.el('li');
      li.appendChild(U.el('span', null, k));
      li.appendChild(U.el('b', null, String(v)));
      ul.appendChild(li);
    };
    row('Opponent', info.enemyName + ' · ' + info.deckName);
    row('Battle length', U.fmtTime(r.time));
    row('Elixir spent', Math.round(b.sides.player.elixirSpent));
    row('Cards played', b.sides.player.cardsPlayed);
    row('Result', r.reason);
    if (!info.practice) row('Streak', NS.Game.save.streak);

    NS.Game.overlay('result');
  };

  BS.forfeit = function () {
    const b = BS.battle;
    if (b && b.phase !== 'ended') b.forfeit('player');
    BS.paused = false;
    NS.Game.hideOverlay('pause');
    // let the result flow handle bookkeeping
    if (b && !BS._resultShown) { BS._resultShown = true; BS.showResult(); }
  };

  NS.BattleScreen = BS;
})(window.COC);

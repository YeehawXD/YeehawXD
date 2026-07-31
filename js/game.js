/* Clash of Critters — game.js
 * Profile/save data, screen routing, and every screen that is not the battle
 * itself: menu, deck builder, collection, card detail, stats, settings, practice.
 */
window.COC = window.COC || {};
(function (NS) {
  'use strict';

  const U = NS.U;
  const $ = U.$, $$ = U.$$;
  const Cards = NS.Cards;
  const Render = NS.Render;
  const Audio = NS.Audio;

  const Game = {
    save: null,
    screen: 'menu',
    deckEditIndex: 0,
    cardFilter: 'all',
  };

  // ------------------------------------------------------------- arenas
  const ARENAS = [
    { at: 0, name: 'Meadow Gate' },
    { at: 200, name: 'Bramble Hollow' },
    { at: 500, name: 'Sunfall Creek' },
    { at: 900, name: 'Thunder Glade' },
    { at: 1400, name: 'Frostpetal Peak' },
    { at: 2000, name: 'Ember Canopy' },
    { at: 2800, name: 'Critter Colosseum' },
  ];
  Game.arenaFor = function (trophies) {
    let a = ARENAS[0];
    for (const x of ARENAS) if (trophies >= x.at) a = x;
    return a;
  };
  Game.difficultyFor = function (trophies) {
    if (trophies < 250) return 'easy';
    if (trophies < 800) return 'normal';
    if (trophies < 1700) return 'hard';
    return 'insane';
  };

  // ------------------------------------------------------------- save
  const DEFAULT_SAVE = () => ({
    v: 1,
    trophies: 0,
    best: 0,
    wins: 0, losses: 0, draws: 0,
    crownsFor: 0, crownsAgainst: 0,
    battles: 0,
    streak: 0, bestStreak: 0,
    deck: Cards.STARTER_DECK.slice(),
    cardStats: {},
    settings: {
      sfx: 0.7, music: 0.3, haptics: true,
      quality: 'high', showDamage: true, speed: 1,
    },
  });

  Game.load = function () {
    const s = U.storage.load();
    Game.save = Object.assign(DEFAULT_SAVE(), s || {});
    Game.save.settings = Object.assign(DEFAULT_SAVE().settings, (s && s.settings) || {});
    // guard against a deck saved before a card was renamed/removed
    Game.save.deck = (Game.save.deck || []).filter((id) => Cards.get(id) && !Cards.get(id).hidden);
    while (Game.save.deck.length < 8) {
      const missing = Cards.list.find((c) => !Game.save.deck.includes(c.id));
      Game.save.deck.push(missing.id);
    }
    Game.save.deck = Game.save.deck.slice(0, 8);
    Game.applySettings();
  };
  Game.persist = function () { U.storage.save(Game.save); };

  Game.applySettings = function () {
    const st = Game.save.settings;
    Audio.setSfxVolume(st.sfx);
    Audio.setMusicVolume(st.music);
    Audio.haptics = !!st.haptics;
    Render.quality = st.quality;
  };

  // ------------------------------------------------------------- routing
  Game.show = function (name) {
    $$('.screen').forEach((s) => s.classList.remove('active'));
    const el = $('#s-' + name);
    if (el) el.classList.add('active');
    Game.screen = name;
    if (name === 'menu') Game.renderMenu();
    if (name === 'deck') Game.renderDeck();
    if (name === 'cards') Game.renderCollection();
    if (name === 'stats') Game.renderStats();
    if (name === 'settings') Game.renderSettings();
    if (name === 'practice') Game.renderPractice();
  };
  Game.overlay = function (name) {
    const el = $('#s-' + name);
    if (el) el.classList.add('active');
  };
  Game.hideOverlay = function (name) {
    const el = $('#s-' + name);
    if (el) el.classList.remove('active');
  };

  let toastTimer = null;
  Game.toast = function (msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1700);
  };

  // ------------------------------------------------------------- card DOM
  Game.cardEl = function (card, opts) {
    opts = opts || {};
    const el = U.el('div', 'card');
    el.style.setProperty('--rarity', Cards.RARITY_COLOR[card.rarity] || '#9fb3c8');
    el.dataset.card = card.id;

    const size = opts.size || 90;
    const thumb = Render.cardThumb(card, size);
    const cv = U.el('canvas');
    cv.width = thumb.width; cv.height = thumb.height;
    cv.getContext('2d').drawImage(thumb, 0, 0);
    el.appendChild(cv);

    if (!opts.noCost) {
      const cost = U.el('div', 'cost', String(card.cost));
      el.appendChild(cost);
    }
    if (!opts.noName) {
      el.appendChild(U.el('div', 'cname', card.name));
    }
    return el;
  };

  // ------------------------------------------------------------- menu
  let mascotRAF = null;
  Game.renderMenu = function () {
    const s = Game.save;
    $('#menu-trophies').textContent = s.trophies;
    $('#menu-arena').textContent = Game.arenaFor(s.trophies).name;
    $('#menu-record').textContent = s.wins + '–' + s.losses;
    const diff = Game.difficultyFor(s.trophies);
    $('#menu-difficulty-label').textContent = 'vs ' + NS.AI_DIFFICULTY[diff].label;
    startMascot();
  };

  function startMascot() {
    const cv = $('#menu-mascot');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = 340, h = 240;
    cv.width = w * dpr; cv.height = h * dpr;
    cancelAnimationFrame(mascotRAF);
    // Three cheerful critters waving on the title screen.
    const cast = ['thistleknight', 'sprigarcher', 'emberfox'].map((id) => Cards.get(id));
    const t0 = performance.now();
    function frame(now) {
      if (Game.screen !== 'menu') return;
      const t = (now - t0) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      cast.forEach((c, i) => {
        const x = 60 + i * 110;
        const y = 200 - Math.abs(Math.sin(t * 1.6 + i * 0.8)) * 10;
        ctx.save();
        ctx.translate(x, y);
        NS.Art.shadow(ctx, 0, 4, 34, 0.18);
        NS.Art.critter(ctx, c.art, {
          t: t + i, scale: 78, walk: t * 4 + i * 2, moving: true,
          attack: (Math.sin(t * 1.1 + i * 2) > 0.94) ? 0.5 : 0,
        });
        ctx.restore();
      });
      mascotRAF = requestAnimationFrame(frame);
    }
    mascotRAF = requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------- deck
  Game.renderDeck = function () {
    const slots = $('#deck-slots');
    slots.innerHTML = '';
    Game.save.deck.forEach((id, i) => {
      const c = Cards.get(id);
      const el = Game.cardEl(c, { size: 100 });
      if (i === Game.deckEditIndex) el.classList.add('active');
      el.addEventListener('click', () => {
        Game.deckEditIndex = i;
        Audio.play('select');
        Game.renderDeck();
      });
      slots.appendChild(el);
    });

    const deck = Game.save.deck.map((id) => Cards.get(id));
    const avg = deck.reduce((s, c) => s + c.cost, 0) / deck.length;
    $('#deck-avg').textContent = avg.toFixed(1);

    const wincons = deck.filter((c) => c.targets === 'buildings' || c.deployAnywhere ||
      (c.kind === 'troop' && c.hp * c.count >= 2200));
    const air = deck.filter((c) => c.kind === 'troop' &&
      (c.targets === 'both' || c.targets === 'air'));
    const splash = deck.filter((c) => (c.splash || 0) > 0 || c.kind === 'spell');

    const set = (sel, n, min) => {
      const el = $(sel);
      el.textContent = n;
      el.className = n >= min ? 'good' : 'bad';
    };
    set('#deck-wincon', wincons.length, 1);
    set('#deck-air', air.length, 2);
    set('#deck-splash', splash.length, 2);

    const warns = [];
    if (!wincons.length) warns.push('No win condition — nothing in this deck reliably threatens a tower.');
    if (air.length < 2) warns.push('Thin air defence. Fliers will run you over with only ' + air.length + ' answer' + (air.length === 1 ? '' : 's') + '.');
    if (splash.length < 2) warns.push('Little splash damage. Swarms of small critters will be hard to clear.');
    if (avg > 4.4) warns.push('Average elixir ' + avg.toFixed(1) + ' is heavy — you will often be caught with an empty bar.');
    if (avg < 2.6) warns.push('Very cheap deck. Fast to cycle, but it may lack the punch to finish a tower.');
    const wd = $('#deck-warnings');
    wd.innerHTML = '';
    if (!warns.length) {
      wd.appendChild(U.el('div', 'warn ok', 'Well-rounded deck. Good luck out there.'));
    } else {
      warns.forEach((w) => wd.appendChild(U.el('div', 'warn', w)));
    }

    const coll = $('#deck-collection');
    coll.innerHTML = '';
    Cards.list.slice().sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name)).forEach((c) => {
      const el = Game.cardEl(c, { size: 80 });
      const inDeck = Game.save.deck.includes(c.id);
      if (inDeck) el.classList.add('in-deck');
      el.addEventListener('click', () => {
        if (Game.save.deck.includes(c.id)) {
          const at = Game.save.deck.indexOf(c.id);
          if (at === Game.deckEditIndex) return;
          // swap the two slots rather than refusing the tap
          const cur = Game.save.deck[Game.deckEditIndex];
          Game.save.deck[at] = cur;
          Game.save.deck[Game.deckEditIndex] = c.id;
        } else {
          Game.save.deck[Game.deckEditIndex] = c.id;
        }
        Game.deckEditIndex = (Game.deckEditIndex + 1) % 8;
        Audio.play('click');
        Game.persist();
        Game.renderDeck();
      });
      coll.appendChild(el);
    });
  };

  Game.randomDeck = function () {
    const rng = U.rng(Date.now() & 0xffffff);
    const pool = Cards.list.slice();
    // guarantee a playable shape: 1 win condition, 2 air answers, 2 splash, 1 spell
    const pick = [];
    const take = (filter) => {
      const opts = pool.filter((c) => !pick.includes(c) && filter(c));
      if (!opts.length) return;
      pick.push(opts[rng.int(0, opts.length - 1)]);
    };
    take((c) => c.targets === 'buildings');
    take((c) => c.kind === 'troop' && c.hp * c.count >= 2000);
    take((c) => c.kind === 'troop' && (c.targets === 'both' || c.targets === 'air'));
    take((c) => c.kind === 'troop' && (c.targets === 'both' || c.targets === 'air'));
    take((c) => (c.splash || 0) > 0);
    take((c) => c.kind === 'spell' && c.cost <= 3);
    take((c) => c.kind === 'spell');
    while (pick.length < 8) take(() => true);
    Game.save.deck = pick.slice(0, 8).map((c) => c.id);
    Game.persist();
    Game.renderDeck();
    Audio.play('click');
    Game.toast('Rolled a fresh deck');
  };

  Game.deckCode = function () {
    try { return btoa(Game.save.deck.join(',')).replace(/=+$/, ''); } catch (e) { return ''; }
  };
  Game.applyDeckCode = function (code) {
    let ids;
    try { ids = atob(code.trim()).split(','); } catch (e) { return false; }
    if (!ids || ids.length !== 8) return false;
    if (!ids.every((id) => Cards.get(id) && !Cards.get(id).hidden)) return false;
    if (new Set(ids).size !== 8) return false;
    Game.save.deck = ids;
    Game.persist();
    Game.renderDeck();
    return true;
  };

  // ------------------------------------------------------------- collection
  Game.renderCollection = function () {
    const wrap = $('#all-cards');
    wrap.innerHTML = '';
    const f = Game.cardFilter;
    Cards.list
      .filter((c) => f === 'all' || c.kind === f)
      .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name))
      .forEach((c) => {
        const el = Game.cardEl(c, { size: 100 });
        el.addEventListener('click', () => Game.showCardDetail(c));
        wrap.appendChild(el);
      });
    $$('#card-filters .pill').forEach((p) => p.classList.toggle('active', p.dataset.filter === f));
  };

  function statRow(label, value) {
    const d = U.el('div', 'stat');
    d.appendChild(U.el('span', null, label));
    d.appendChild(U.el('b', null, String(value)));
    return d;
  }

  Game.showCardDetail = function (c) {
    const box = $('#detail-card');
    box.innerHTML = '';

    const head = U.el('div', 'detail-head');
    head.appendChild(Game.cardEl(c, { size: 120, noName: true }));
    const title = U.el('div', 'detail-title');
    title.appendChild(U.el('h3', null, c.name));
    const rar = U.el('div', 'rarity', c.rarity || 'common');
    rar.style.color = Cards.RARITY_COLOR[c.rarity] || '#9fb3c8';
    title.appendChild(rar);
    const kindLabel = c.kind === 'spell' ? 'Spell' : c.kind === 'building' ? 'Building' : 'Troop';
    title.appendChild(U.el('div', 'costline', c.cost + ' elixir · ' + kindLabel +
      (c.count > 1 ? ' · ×' + c.count : '')));
    head.appendChild(title);
    box.appendChild(head);

    box.appendChild(U.el('p', 'detail-blurb', c.blurb || ''));

    const tags = U.el('div', 'tag-row');
    const addTag = (txt, cls) => tags.appendChild(U.el('span', 'tag ' + (cls || ''), txt));
    if (c.kind === 'spell') {
      addTag('Spell', 'spell');
      const s = c.spell;
      if (s.effect === 'freeze') addTag('Freeze');
      if (s.effect === 'stun' || s.effect === 'lightning') addTag('Stun');
      if (s.effect === 'heal') addTag('Heal');
      if (s.knockback) addTag('Knockback');
      addTag('Cast anywhere');
    } else {
      if (c.air) addTag('Air unit', 'air');
      addTag('Hits ' + (c.targets === 'both' ? 'air & ground'
        : c.targets === 'buildings' ? 'buildings only' : c.targets));
      if (c.splash) addTag('Splash', 'splash');
      if (c.kind === 'building') addTag('Building', 'building');
      if (c.deployAnywhere) addTag('Deploy anywhere');
      if (c.jumpsRiver) addTag('Jumps the river');
      if (c.spawner) addTag('Spawns units');
      if (c.death) addTag('Death damage');
      if (c.poison) addTag('Damage over time');
    }
    box.appendChild(tags);

    const grid = U.el('div', 'stat-grid');
    if (c.kind === 'spell') {
      const s = c.spell;
      if (s.dmg) grid.appendChild(statRow('Damage', s.dmg));
      if (s.dmg) grid.appendChild(statRow('Tower damage', Math.round(s.dmg * s.towerMult)));
      if (s.heal) grid.appendChild(statRow('Healing', s.heal));
      grid.appendChild(statRow('Radius', s.radius + ' tiles'));
      if (s.duration) grid.appendChild(statRow('Duration', s.duration + 's'));
      if (s.bolts) grid.appendChild(statRow('Targets', s.bolts));
    } else {
      grid.appendChild(statRow('Hitpoints', c.hp));
      if (c.dmg) {
        grid.appendChild(statRow('Damage', c.dmg));
        grid.appendChild(statRow('Hit speed', c.hitSpeed + 's'));
        grid.appendChild(statRow('DPS', Math.round(c.dmg / c.hitSpeed)));
      }
      if (c.range != null) {
        grid.appendChild(statRow('Range', c.range < 1 ? 'Melee' : c.range + ' tiles'));
      }
      if (c.speed) {
        const names = [['veryFast', 'Very fast'], ['fast', 'Fast'], ['medium', 'Medium'], ['slow', 'Slow']];
        const key = names.find(([k]) => Math.abs(NS.SPEED[k] - c.speed) < 0.01);
        grid.appendChild(statRow('Speed', key ? key[1] : c.speed.toFixed(1)));
      }
      if (c.splash) grid.appendChild(statRow('Splash radius', c.splash + ' tiles'));
      if (c.lifetime) grid.appendChild(statRow('Lifetime', c.lifetime + 's'));
      if (c.count > 1) grid.appendChild(statRow('Total hitpoints', c.hp * c.count));
      grid.appendChild(statRow('Deploy time', c.deployTime + 's'));
      if (c.spawner) {
        grid.appendChild(statRow('Spawns', c.spawner.count + '× ' + Cards.get(c.spawner.unit).name));
        grid.appendChild(statRow('Every', c.spawner.every + 's'));
      }
      if (c.death && c.death.dmg) grid.appendChild(statRow('Death damage', c.death.dmg));
      if (c.poison) grid.appendChild(statRow('Poison', c.poison.dps + '/s for ' + c.poison.duration + 's'));
    }
    box.appendChild(grid);

    const used = Game.save.cardStats[c.id];
    if (used && used.played) {
      const usedBox = U.el('div', 'stat-grid');
      usedBox.appendChild(statRow('Times played', used.played));
      usedBox.appendChild(statRow('In winning games', used.wins));
      box.appendChild(usedBox);
    }

    const inDeck = Game.save.deck.includes(c.id);
    const actions = U.el('div', 'result-actions');
    const addBtn = U.el('button', 'btn btn-gold', inDeck ? 'In your deck' : 'Add to deck');
    addBtn.disabled = inDeck;
    addBtn.addEventListener('click', () => {
      Game.save.deck[Game.deckEditIndex] = c.id;
      Game.deckEditIndex = (Game.deckEditIndex + 1) % 8;
      Game.persist();
      Game.toast(c.name + ' added to your deck');
      Game.hideOverlay('carddetail');
      Audio.play('click');
    });
    const close = U.el('button', 'btn btn-blue', 'Close');
    close.addEventListener('click', () => { Game.hideOverlay('carddetail'); Audio.play('back'); });
    actions.appendChild(addBtn);
    actions.appendChild(close);
    box.appendChild(actions);

    Game.overlay('carddetail');
    Audio.play('select');
  };

  // ------------------------------------------------------------- stats
  Game.renderStats = function () {
    const s = Game.save;
    const body = $('#stats-body');
    body.innerHTML = '';

    const card1 = U.el('div', 'stat-card');
    card1.appendChild(U.el('h3', null, 'Record'));
    const total = s.wins + s.losses + s.draws;
    const kv = (k, v) => {
      const d = U.el('div', 'kv');
      d.appendChild(U.el('span', null, k));
      d.appendChild(U.el('b', null, String(v)));
      card1.appendChild(d);
    };
    kv('Battles', total);
    kv('Wins', s.wins);
    kv('Losses', s.losses);
    kv('Draws', s.draws);
    kv('Win rate', total ? Math.round((s.wins / total) * 100) + '%' : '—');
    kv('Current streak', s.streak);
    kv('Best streak', s.bestStreak);
    body.appendChild(card1);

    const card2 = U.el('div', 'stat-card');
    card2.appendChild(U.el('h3', null, 'Trophies'));
    const kv2 = (k, v) => {
      const d = U.el('div', 'kv');
      d.appendChild(U.el('span', null, k));
      d.appendChild(U.el('b', null, String(v)));
      card2.appendChild(d);
    };
    kv2('Current', s.trophies);
    kv2('Personal best', s.best);
    kv2('Arena', Game.arenaFor(s.trophies).name);
    kv2('Facing', NS.AI_DIFFICULTY[Game.difficultyFor(s.trophies)].label);
    kv2('Crowns taken', s.crownsFor);
    kv2('Crowns conceded', s.crownsAgainst);
    body.appendChild(card2);

    const entries = Object.entries(s.cardStats)
      .filter(([id]) => Cards.get(id))
      .sort((a, b) => b[1].played - a[1].played)
      .slice(0, 12);
    if (entries.length) {
      const card3 = U.el('div', 'stat-card');
      card3.appendChild(U.el('h3', null, 'Most played critters'));
      const max = entries[0][1].played || 1;
      entries.forEach(([id, st]) => {
        const row = U.el('div', 'bar-row');
        const lab = U.el('div', 'bar-label');
        lab.appendChild(U.el('span', null, Cards.get(id).name));
        const wr = st.played ? Math.round((st.wins / st.played) * 100) : 0;
        lab.appendChild(U.el('span', null, st.played + '× · ' + wr + '% wins'));
        row.appendChild(lab);
        const track = U.el('div', 'bar-track');
        const fill = U.el('div', 'bar-fill');
        fill.style.width = Math.round((st.played / max) * 100) + '%';
        track.appendChild(fill);
        row.appendChild(track);
        card3.appendChild(row);
      });
      body.appendChild(card3);
    }

    const reset = U.el('button', 'btn btn-ghost', 'Reset all progress');
    reset.addEventListener('click', () => {
      if (reset.dataset.armed) {
        U.storage.clear();
        Game.load();
        Game.renderStats();
        Game.toast('Progress reset');
        Audio.play('back');
      } else {
        reset.dataset.armed = '1';
        reset.textContent = 'Tap again to confirm';
      }
    });
    body.appendChild(reset);
  };

  // ------------------------------------------------------------- settings
  function switchRow(label, hint, get, set) {
    const row = U.el('div', 'setting-row');
    const left = U.el('div');
    left.appendChild(U.el('div', 'label', label));
    if (hint) left.appendChild(U.el('div', 'hint', hint));
    row.appendChild(left);
    const sw = U.el('div', 'switch' + (get() ? ' on' : ''));
    sw.addEventListener('click', () => {
      set(!get());
      sw.classList.toggle('on', !!get());
      Game.persist();
      Game.applySettings();
      Audio.play('click');
    });
    row.appendChild(sw);
    return row;
  }

  function sliderRow(label, hint, get, set) {
    const row = U.el('div', 'setting-row');
    const left = U.el('div');
    left.appendChild(U.el('div', 'label', label));
    if (hint) left.appendChild(U.el('div', 'hint', hint));
    row.appendChild(left);
    const inp = U.el('input');
    inp.type = 'range'; inp.min = '0'; inp.max = '1'; inp.step = '0.05';
    inp.value = String(get());
    inp.addEventListener('input', () => {
      set(parseFloat(inp.value));
      Game.applySettings();
    });
    inp.addEventListener('change', () => { Game.persist(); Audio.play('select'); });
    row.appendChild(inp);
    return row;
  }

  function choiceRow(label, hint, options, get, set) {
    const wrap = U.el('div', 'setting-row');
    wrap.style.flexDirection = 'column';
    wrap.style.alignItems = 'stretch';
    const left = U.el('div');
    left.appendChild(U.el('div', 'label', label));
    if (hint) left.appendChild(U.el('div', 'hint', hint));
    wrap.appendChild(left);
    const row = U.el('div', 'choice-row');
    row.style.marginTop = '8px';
    options.forEach((o) => {
      const b = U.el('button', 'choice' + (get() === o.value ? ' active' : ''));
      b.appendChild(document.createTextNode(o.label));
      if (o.sub) b.appendChild(U.el('span', 'sub', o.sub));
      b.addEventListener('click', () => {
        set(o.value);
        Game.persist();
        Game.applySettings();
        Array.from(row.children).forEach((c, i) => c.classList.toggle('active', options[i].value === get()));
        Audio.play('click');
      });
      row.appendChild(b);
    });
    wrap.appendChild(row);
    return wrap;
  }

  Game.renderSettings = function () {
    const st = Game.save.settings;
    const body = $('#settings-body');
    body.innerHTML = '';
    const card = U.el('div', 'stat-card');
    card.appendChild(U.el('h3', null, 'Sound'));
    card.appendChild(sliderRow('Sound effects', 'Hits, spells, towers', () => st.sfx, (v) => { st.sfx = v; }));
    card.appendChild(sliderRow('Music', 'Background loop', () => st.music, (v) => { st.music = v; }));
    card.appendChild(switchRow('Haptics', 'Vibrate on deploys and crowns', () => st.haptics, (v) => { st.haptics = v; }));
    body.appendChild(card);

    const card2 = U.el('div', 'stat-card');
    card2.appendChild(U.el('h3', null, 'Display'));
    card2.appendChild(choiceRow('Graphics', 'Lower this if the battle feels choppy', [
      { value: 'high', label: 'High' },
      { value: 'low', label: 'Low', sub: 'faster' },
    ], () => st.quality, (v) => {
      st.quality = v;
      if (NS.BattleScreen) NS.BattleScreen.resize();
    }));
    card2.appendChild(switchRow('Damage numbers', 'Show floating damage in battle',
      () => st.showDamage, (v) => { st.showDamage = v; }));
    body.appendChild(card2);

    const card3 = U.el('div', 'stat-card');
    card3.appendChild(U.el('h3', null, 'About'));
    const p = U.el('p');
    p.style.fontSize = '13px';
    p.style.color = 'var(--text-dim)';
    p.style.lineHeight = '1.5';
    p.textContent = 'Clash of Critters is an offline, single-player lane battler. ' +
      'Everything you see is drawn in code — no images, no downloads, no accounts. ' +
      'Your progress lives in this browser only.';
    card3.appendChild(p);
    body.appendChild(card3);
  };

  // ------------------------------------------------------------- practice
  Game.practiceOpts = { difficulty: 'normal', infiniteElixir: false, enemyDeck: 0, speed: 1 };

  Game.renderPractice = function () {
    const body = $('#practice-body');
    body.innerHTML = '';
    const o = Game.practiceOpts;

    const card = U.el('div', 'stat-card');
    card.appendChild(U.el('h3', null, 'Opponent'));
    card.appendChild(choiceRow('Difficulty', 'How quickly the rival reacts and how well it answers', [
      { value: 'easy', label: 'Sprout', sub: 'slow' },
      { value: 'normal', label: 'Scrapper' },
      { value: 'hard', label: 'Champion' },
      { value: 'insane', label: 'Legend', sub: 'brutal' },
    ], () => o.difficulty, (v) => { o.difficulty = v; }));

    const deckOpts = Cards.AI_DECKS.map((d, i) => ({ value: i, label: d.name }));
    card.appendChild(choiceRow('Rival deck', 'Pick an archetype to practise against',
      deckOpts, () => o.enemyDeck, (v) => { o.enemyDeck = v; }));
    body.appendChild(card);

    const card2 = U.el('div', 'stat-card');
    card2.appendChild(U.el('h3', null, 'Rules'));
    card2.appendChild(switchRow('Infinite elixir', 'Your cards cost nothing — for testing decks',
      () => o.infiniteElixir, (v) => { o.infiniteElixir = v; }));
    card2.appendChild(choiceRow('Game speed', 'Run the simulation faster to test end-games', [
      { value: 1, label: '1×' },
      { value: 2, label: '2×' },
      { value: 3, label: '3×' },
    ], () => o.speed, (v) => { o.speed = v; }));
    body.appendChild(card2);

    const note = U.el('div', 'stat-card');
    note.appendChild(U.el('h3', null, 'Note'));
    const p = U.el('p');
    p.style.cssText = 'font-size:13px;color:var(--text-dim);line-height:1.5;margin:0';
    p.textContent = 'Practice battles never change your trophies or record.';
    note.appendChild(p);
    body.appendChild(note);

    const go = U.el('button', 'btn btn-gold btn-xl', 'Start practice');
    go.addEventListener('click', () => {
      NS.BattleScreen.start({
        difficulty: o.difficulty,
        enemyDeck: Cards.AI_DECKS[o.enemyDeck].cards,
        enemyName: Cards.AI_DECKS[o.enemyDeck].name,
        practice: true,
        infiniteElixir: o.infiniteElixir,
        speed: o.speed,
      });
    });
    body.appendChild(go);
  };

  // ------------------------------------------------------------- results
  Game.recordResult = function (battle, info) {
    const s = Game.save;
    const r = battle.result;
    const won = r.winner === 'player';
    const drew = !r.winner;

    if (!info.practice) {
      s.battles++;
      s.crownsFor += r.crowns.player;
      s.crownsAgainst += r.crowns.enemy;
      if (won) { s.wins++; s.streak = Math.max(1, s.streak + 1); }
      else if (drew) { s.draws++; }
      else { s.losses++; s.streak = Math.min(-1, s.streak - 1); }
      s.bestStreak = Math.max(s.bestStreak, s.streak);

      const base = 30;
      const delta = drew ? 0 : won ? base + r.crowns.player * 3 : -(base - r.crowns.player * 5);
      s.trophies = Math.max(0, s.trophies + delta);
      s.best = Math.max(s.best, s.trophies);
      info.delta = delta;

      battle.sides.player.deck.forEach((id) => {
        const st = s.cardStats[id] || (s.cardStats[id] = { played: 0, wins: 0 });
        st.played++;
        if (won) st.wins++;
      });
      Game.persist();
    } else {
      info.delta = 0;
    }
    return info;
  };

  NS.Game = Game;
  NS.ARENAS = ARENAS;
})(window.COC);

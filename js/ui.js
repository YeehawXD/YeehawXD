/* Critter Clash — ui.js
 * Screen routing and every screen's rendering, plus the battle loop.
 */
window.COC = window.COC || {};
(function (NS) {
  'use strict';

  const U = NS.U;
  const $ = U.$, $$ = U.$$;
  const CA = NS.CritterArt;
  const R = NS.Roster;
  const C = NS.Combat;
  const RM = NS.RunMod;
  const View = NS.BattleView;
  const Audio = NS.Audio;

  const UI = {
    screen: 'title',
    stack: [],
    run: null,
    battle: null,
    node: null,
    encounter: null,
    pick: null,          // critter id currently picked up on the formation screen
    codexFilter: 'all',
    save: null,
    raf: null,
    speed: 1,
    _thumbs: {},
  };

  const NODE_ICON = {
    battle: '⚔️', elite: '☠️', shop: '🛒', rest: '🔥', treasure: '🎁', boss: '👑',
  };
  const NODE_NAME = {
    battle: 'Kamp', elite: 'Elite', shop: 'Bod', rest: 'Lejr', treasure: 'Fund', boss: 'Boss',
  };

  // ---------------------------------------------------------------- save
  const DEFAULT_SAVE = () => ({
    v: 1,
    settings: { sfx: 0.7, music: 0.25, autoUlt: false, speed: 1, reduceMotion: false },
    seen: {},                 // critter ids encountered
    bestAct: 0, runsWon: 0, runsPlayed: 0,
    run: null,                // serialised run in progress
  });

  UI.loadSave = function () {
    UI.save = Object.assign(DEFAULT_SAVE(), U.storage.load() || {});
    UI.save.settings = Object.assign(DEFAULT_SAVE().settings, UI.save.settings || {});
    Audio.setSfxVolume(UI.save.settings.sfx);
    Audio.setMusicVolume(UI.save.settings.music);
    UI.speed = UI.save.settings.speed || 1;
  };
  UI.persist = function () { U.storage.save(UI.save); };

  UI.saveRun = function () {
    if (!UI.run) { UI.save.run = null; UI.persist(); return; }
    const r = UI.run;
    UI.save.run = {
      seed: r.seed, act: r.act, gold: r.gold, relics: r.relics,
      roster: r.roster, formation: r.formation, pos: r.pos,
      map: r.map, battlesWon: r.battlesWon, teamLevel: r.teamLevel,
      rngState: null,
    };
    UI.persist();
  };
  UI.restoreRun = function () {
    const s = UI.save.run;
    if (!s) return null;
    const r = new RM.Run({ seed: s.seed });
    Object.assign(r, {
      act: s.act, gold: s.gold, relics: s.relics, roster: s.roster,
      formation: s.formation, pos: s.pos, map: s.map, battlesWon: s.battlesWon,
      teamLevel: s.teamLevel || 1,
    });
    return r;
  };

  // ---------------------------------------------------------------- routing
  UI.show = function (name, opts) {
    opts = opts || {};
    if (!opts.replace && UI.screen && UI.screen !== name) UI.stack.push(UI.screen);
    $$('.screen').forEach((s) => s.classList.remove('active'));
    const el = $('#s-' + name);
    if (el) el.classList.add('active');
    UI.screen = name;
    const fn = UI['render' + name.charAt(0).toUpperCase() + name.slice(1)];
    if (fn) fn();
  };
  UI.overlay = function (name) { $('#s-' + name).classList.add('active'); };
  UI.hideOverlay = function (name) { $('#s-' + name).classList.remove('active'); };
  UI.back = function () {
    const prev = UI.stack.pop() || 'title';
    UI.show(prev, { replace: true });
  };

  let toastT = null;
  UI.toast = function (msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 1800);
  };

  // ---------------------------------------------------------------- art helpers
  /** Cached square portrait of a critter. */
  UI.thumb = function (critter, size) {
    const key = critter.id + '@' + size;
    if (UI._thumbs[key]) return UI._thumbs[key];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const c = document.createElement('canvas');
    c.width = size * dpr; c.height = size * dpr;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    const el = R.ELEMENTS[critter.element];
    const g = ctx.createRadialGradient(size / 2, size * 0.42, 0, size / 2, size * 0.42, size * 0.66);
    g.addColorStop(0, U.rgba(el.color, 0.35));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    ctx.save();
    ctx.translate(size / 2, size * 0.88);
    CA.draw(ctx, critter, { t: 0.6, scale: size * 0.56, st: { attack: 0, walk: 0, moving: false } });
    ctx.restore();
    UI._thumbs[key] = c;
    return c;
  };

  function cloneThumb(critter, size) {
    const src = UI.thumb(critter, size);
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
  }

  /** A critter card used on the bench, in the codex and in reward lists. */
  UI.card = function (critter, opts) {
    opts = opts || {};
    const el = U.el('button', 'ccard');
    el.type = 'button';
    el.style.setProperty('--grade', R.GRADE[critter.grade].color);
    el.dataset.id = critter.id;
    el.appendChild(cloneThumb(critter, opts.size || 96));
    const dot = U.el('i', 'el');
    dot.style.background = R.ELEMENTS[critter.element].color;
    el.appendChild(dot);
    if (opts.level) el.appendChild(U.el('span', 'lv', 'N' + opts.level));
    const stars = U.el('span', 'stars');
    const n = R.RARITY[critter.rarity].stars;
    for (let i = 0; i < n; i++) stars.appendChild(U.el('i', null, '\u2605'));
    stars.style.color = R.RARITY[critter.rarity].color;
    el.appendChild(stars);
    const rd = U.el('i', 'role-dot');
    rd.style.background = R.ROLES[critter.role].color;
    el.appendChild(rd);
    el.appendChild(U.el('span', 'nm', critter.name));
    return el;
  };

  // ---------------------------------------------------------------- title
  let titleRAF = null;
  UI.renderTitle = function () {
    $('#btn-continue').style.display = UI.save.run ? '' : 'none';
    const s = UI.save;
    $('#title-runsub').textContent = s.runsWon
      ? s.runsWon + (s.runsWon === 1 ? ' rejse' : ' rejser') + ' fuldført'
      : 'Tre regioner · syv kritter';

    const cv = $('#title-art');
    const ctx = cv.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = 420, h = 300;
    cv.width = w * dpr; cv.height = h * dpr;
    cancelAnimationFrame(titleRAF);
    const cast = ['grumle', 'rodde', 'askeoje', 'sjatte', 'glimt'].map((id) => R.get(id));
    const t0 = performance.now();
    (function frame(now) {
      if (UI.screen !== 'title') return;
      const t = (now - t0) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      // a soft stage light behind the line-up
      const g = ctx.createRadialGradient(w / 2, h * 0.62, 10, w / 2, h * 0.62, w * 0.55);
      g.addColorStop(0, 'rgba(255,201,77,0.16)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      cast.forEach((c, i) => {
        const order = [0, 2, 4, 1, 3][i];
        const x = 62 + order * 74;
        const y = 250 + Math.sin(t * 1.4 + i) * 4;
        ctx.save();
        ctx.translate(x, y);
        CA.draw(ctx, c, {
          t: t + i * 1.3, scale: 74 - Math.abs(order - 2) * 5,
          st: {
            walk: t * 3.4 + i, moving: false,
            attack: (Math.sin(t * 0.7 + i * 2.1) > 0.96) ? 0.5 : 0,
          },
        });
        ctx.restore();
      });
      titleRAF = requestAnimationFrame(frame);
    })(performance.now());
  };

  // ---------------------------------------------------------------- run start
  UI.newRun = function () {
    UI.run = new RM.Run({});
    UI.run.roster.forEach((e) => { UI.save.seen[e.id] = true; });
    UI.save.runsPlayed++;
    UI.saveRun();
    UI.stack = ['title'];
    UI.show('map', { replace: true });
    Audio.play('start');
  };

  UI.continueRun = function () {
    const r = UI.restoreRun();
    if (!r) { UI.toast('Ingen rejse at fortsætte'); return; }
    UI.run = r;
    UI.stack = ['title'];
    UI.show('map', { replace: true });
  };

  // ---------------------------------------------------------------- map
  UI.renderMap = function () {
    const run = UI.run;
    if (!run) { UI.show('title', { replace: true }); return; }
    const act = run.act0();
    $('#map-act').textContent = act.name;
    $('#map-sub').textContent = 'Region ' + act.n + ' · Holdniveau ' + run.teamLevel;
    $('#map-gold').textContent = run.gold;

    // relics
    const strip = $('#relic-strip');
    strip.innerHTML = '';
    run.relicObjects().forEach((r) => {
      const pip = U.el('div', 'relic-pip', relicGlyph(r.icon));
      pip.title = r.name + ' — ' + r.text;
      pip.addEventListener('click', () => UI.toast(r.name + ': ' + r.text));
      strip.appendChild(pip);
    });

    // team preview
    const mini = $('#team-mini');
    mini.innerHTML = '';
    run.formation.forEach((id) => {
      if (!id) return;
      const e = run.owned(id);
      const c = R.get(id);
      const cv = cloneThumb(c, 34);
      if (e.hpFrac < 0.5) cv.classList.add('hurt');
      cv.title = c.name + ' · ' + Math.round(e.hpFrac * 100) + '%';
      mini.appendChild(cv);
    });

    // nodes
    const inner = $('#map-inner');
    inner.innerHTML = '';
    const avail = run.available();
    const isAvail = (r, i) => avail.some((a) => a.row === r && a.idx === i);

    run.map.forEach((row, r) => {
      const rowEl = U.el('div', 'map-row');
      rowEl.dataset.row = String(r);
      row.forEach((node, i) => {
        const btn = U.el('button', 'map-node');
        btn.type = 'button';
        btn.dataset.type = node.type;
        btn.appendChild(document.createTextNode(NODE_ICON[node.type]));
        btn.appendChild(U.el('span', 'node-name', NODE_NAME[node.type]));
        const here = run.pos && run.pos.row === r && run.pos.idx === i;
        if (here) btn.classList.add('current');
        else if (node.visited) btn.classList.add('done');
        if (isAvail(r, i)) {
          btn.classList.add('reachable');
          btn.addEventListener('click', () => UI.enterNode(r, i));
        }
        rowEl.appendChild(btn);
      });
      inner.appendChild(rowEl);
    });

    // Edges are drawn once the rows have real positions. Without them the map
    // is just a column of icons — the branching has to be visible to matter.
    requestAnimationFrame(() => {
      drawMapEdges(run, inner);
      const sc = $('#map-scroll');
      const rowEls = $$('.map-row', inner);
      const target = rowEls[run.currentRow()] || rowEls[rowEls.length - 1];
      if (target) sc.scrollTop = Math.max(0, target.offsetTop - sc.clientHeight * 0.55);
    });
  };

  function drawMapEdges(run, inner) {
    const old = inner.querySelector('.map-edges');
    if (old) old.remove();
    const rowEls = $$('.map-row', inner);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'map-edges');
    svg.setAttribute('width', inner.clientWidth);
    svg.setAttribute('height', inner.scrollHeight);
    const centre = (r, i) => {
      const el = rowEls[r] && rowEls[r].children[i];
      if (!el) return null;
      return {
        x: el.offsetLeft + rowEls[r].offsetLeft + el.offsetWidth / 2,
        y: el.offsetTop + rowEls[r].offsetTop + el.offsetHeight / 2,
      };
    };
    const avail = run.available();
    run.map.forEach((row, r) => {
      row.forEach((node, i) => {
        const a = centre(r, i);
        if (!a) return;
        node.next.forEach((j) => {
          const b = centre(r + 1, j);
          if (!b) return;
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          const my = (a.y + b.y) / 2;
          line.setAttribute('d', 'M' + a.x + ',' + a.y + ' C' + a.x + ',' + my + ' ' + b.x + ',' + my + ' ' + b.x + ',' + b.y);
          const live = run.pos && run.pos.row === r && run.pos.idx === i &&
            avail.some((p) => p.row === r + 1 && p.idx === j);
          const walked = node.visited && run.map[r + 1][j].visited;
          line.setAttribute('stroke', live ? 'rgba(255,201,77,.85)' : walked ? 'rgba(98,214,138,.5)' : 'rgba(255,255,255,.14)');
          line.setAttribute('stroke-width', live ? 3 : 2);
          line.setAttribute('fill', 'none');
          if (!live && !walked) line.setAttribute('stroke-dasharray', '5 6');
          svg.appendChild(line);
        });
      });
    });
    inner.insertBefore(svg, inner.firstChild);
  }

  function relicGlyph(icon) {
    return ({
      sun: '☀️', shield: '🛡️', wind: '🌬️', rock: '🪨', drop: '💧', fang: '🦷',
      bow: '🏹', clover: '🍀', leaf: '🍃', gem: '💎', lamp: '🏮', horn: '📯', feather: '🪶',
    })[icon] || '✨';
  }

  UI.enterNode = function (r, i) {
    const run = UI.run;
    const node = run.enter({ row: r, idx: i });
    UI.node = node;
    Audio.play('click');
    switch (node.type) {
      case 'battle': case 'elite': case 'boss':
        UI.encounter = RM.makeEncounter(run.rng, run, node);
        UI.show('team');
        break;
      case 'shop': UI.show('shop'); break;
      case 'rest': UI.show('rest'); break;
      case 'treasure': UI.openTreasure(); break;
      default: break;
    }
    UI.saveRun();
  };

  // ---------------------------------------------------------------- formation
  UI.renderTeam = function () {
    const run = UI.run;
    const board = $('#board');
    board.innerHTML = '';
    // back row first so it reads top-to-bottom like the battlefield
    [3, 4, 5, 0, 1, 2].forEach((slot) => {
      const cell = U.el('div', 'slot');
      cell.dataset.slot = String(slot);
      const id = run.formation[slot];
      if (id) {
        const c = R.get(id);
        const e = run.owned(id);
        cell.classList.add('filled');
        cell.appendChild(cloneThumb(c, 92));
        const dot = U.el('i', 'slot-el');
        dot.style.background = R.ELEMENTS[c.element].color;
        cell.appendChild(dot);
        const hp = U.el('div', 'slot-hp');
        const fill = U.el('i');
        fill.style.width = Math.round(e.hpFrac * 100) + '%';
        fill.style.background = e.hpFrac > 0.5 ? 'var(--good)' : e.hpFrac > 0.25 ? 'var(--gold)' : 'var(--danger)';
        hp.appendChild(fill);
        cell.appendChild(hp);
        cell.appendChild(U.el('span', 'slot-name', c.name));
        if (bondActive(run, slot)) cell.appendChild(U.el('span', 'slot-bond', '★'));
        if (UI.pick === id) cell.classList.add('selected');
      }
      if (UI.pick) cell.classList.add('target');
      cell.addEventListener('click', () => UI.tapSlot(slot));
      board.appendChild(cell);
    });

    // bench
    const bench = $('#bench');
    bench.innerHTML = '';
    run.roster.forEach((e) => {
      const c = R.get(e.id);
      const card = UI.card(c, { size: 90, level: run.levelOf(e) });
      if (run.formation.includes(e.id)) card.classList.add('deployed');
      if (UI.pick === e.id) card.classList.add('chosen');
      card.addEventListener('click', () => UI.tapBench(e.id));
      bench.appendChild(card);
    });

    // bond summary
    const note = $('#bond-note');
    const bonds = activeBonds(run);
    if (!bonds.length) {
      note.className = 'bond-note empty';
      note.textContent = 'Ingen bånd aktive. Prøv at flytte kritterne hen ved siden af deres foretrukne allierede.';
    } else {
      note.className = 'bond-note';
      note.innerHTML = bonds.map((b) => '<b>' + b.name + '</b> ' + b.text).join('<br>');
    }

    const enc = UI.encounter;
    $('#team-sub').textContent = enc
      ? (enc.boss ? 'Boss: ' + enc.name : enc.name + ' · Niveau ' + enc.level)
      : 'Tryk på en kritter, tryk så på en plads';
    const fight = $('#btn-fight');
    fight.textContent = enc ? 'Kæmp' : 'Tilbage til kortet';
    fight.disabled = run.deployed() === 0;
  };

  /** A slot's bond condition, evaluated against the current formation. */
  function bondFor(run, slot) {
    const id = run.formation[slot];
    if (!id) return null;
    const c = R.get(id);
    if (!c.bond) return null;
    const [type, value] = c.bond.need.split(':');
    const col = slot % 3, row = Math.floor(slot / 3);
    let n = 0;
    if (type === 'row') {
      n = ((value === 'front') === (row === 0)) ? 1 : 0;
    } else {
      for (let s = 0; s < 6; s++) {
        const oid = run.formation[s];
        if (!oid || s === slot) continue;
        const oc = R.get(oid);
        const dc = Math.abs((s % 3) - col), dr = Math.abs(Math.floor(s / 3) - row);
        if (dc + dr !== 1) continue;
        if (type === 'element' ? oc.element === value : oc.role === value) n++;
      }
    }
    return n > 0 ? { critter: c, n } : null;
  }
  function bondActive(run, slot) { return !!bondFor(run, slot); }
  function activeBonds(run) {
    const out = [];
    for (let s = 0; s < 6; s++) {
      const b = bondFor(run, s);
      if (b) out.push({ name: b.critter.name, text: b.critter.bond.text + (b.n > 1 ? ' (×' + b.n + ')' : '') });
    }
    return out;
  }

  UI.tapBench = function (id) {
    Audio.play('select');
    if (UI.pick === id) { UI.pick = null; UI.renderTeam(); return; }
    UI.pick = id;
    UI.renderTeam();
  };

  UI.tapSlot = function (slot) {
    const run = UI.run;
    const current = run.formation[slot];
    if (UI.pick) {
      const from = run.formation.indexOf(UI.pick);
      // Adding a critter that is not already on the board must respect the cap.
      if (from < 0 && !current && !run.canDeployMore()) {
        UI.toast('Du kan højst opstille ' + RM.Run.MAX_DEPLOY + ' kritter');
        Audio.play('deny');
        return;
      }
      if (from >= 0) run.formation[from] = current || null;   // swap
      run.formation[slot] = UI.pick;
      UI.pick = null;
      Audio.play('place');
    } else if (current) {
      // lift the critter off the board
      UI.pick = current;
      Audio.play('select');
    }
    UI.renderTeam();
    UI.saveRun();
  };

  // ---------------------------------------------------------------- battle
  UI.startBattle = function () {
    const run = UI.run;
    const enc = UI.encounter;
    const allies = run.allyEntries();
    const battle = new C.Battle({
      allies, foes: enc.foes,
      relics: run.relicObjects(),
      autoUlt: UI.save.settings.autoUlt,
      seed: (run.seed + run.battlesWon * 977) | 0,
    });
    // carry wounds forward
    battle.allOf('ally').forEach((u) => {
      const e = run.owned(u.def.id);
      if (e) { u.hp = Math.max(1, Math.round(u.maxHp * e.hpFrac)); }
    });
    battle.prism = run.relicFlag('prism');
    UI.battle = battle;
    enc.foes.forEach((f) => { UI.save.seen[f.id] = true; });

    $('#battle-foe').textContent = enc.name;
    $('#battle-lvl').textContent = 'Niveau ' + enc.level + (enc.boss ? ' · Boss' : '');
    $('#btn-auto').classList.toggle('on', !!UI.save.settings.autoUlt);
    $('#btn-speed').textContent = UI.speed + '×';

    UI.show('battle');
    View.setTheme(run.act0());
    requestAnimationFrame(() => {
      UI.resizeBattle();
      UI.renderUltBar();
    });
    UI.loopStart();
    Audio.startMusic(120);
  };

  UI.resizeBattle = function () {
    const f = $('#field');
    const r = f.getBoundingClientRect();
    if (r.width > 10 && r.height > 10) View.resize(Math.floor(r.width), Math.floor(r.height));
  };

  const STEP = 1 / 60;

  UI.loopStart = function () {
    cancelAnimationFrame(UI.raf);
    UI._ended = false;
    let last = performance.now();
    let acc = 0;

    function frame(now) {
      UI.raf = requestAnimationFrame(frame);
      if (UI.screen !== 'battle' || !UI.battle) return;
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.25) dt = 0.25;          // a backgrounded tab must not fast-forward
      const b = UI.battle;
      if (b.state === 'intro' || b.state === 'fighting') {
        acc += dt * UI.speed;
        let n = 0;
        while (acc >= STEP && n < 12) { b.update(STEP); acc -= STEP; n++; }
        if (acc > STEP * 12) acc = 0;    // never build an unbounded backlog
      } else {
        b.update(dt);
      }
      View.draw(b, UI);
      UI.tickUltBar();
      if ((b.state === 'won' || b.state === 'lost') && !UI._ended) {
        UI._ended = true;
        setTimeout(() => UI.endBattle(), 900);
      }
    }

    // Start on the next frame, never synchronously: on the first frame the
    // canvas has not been laid out yet and has no size.
    UI.raf = requestAnimationFrame(frame);
  };

  UI.renderUltBar = function () {
    const bar = $('#ult-bar');
    bar.innerHTML = '';
    UI._ultBtns = [];
    UI.battle.allOf('ally').forEach((u) => {
      const btn = U.el('button', 'ult-btn');
      btn.type = 'button';
      btn.title = u.def.ult.name + ' — ' + u.def.ult.text;
      const fill = U.el('div', 'fill');
      btn.appendChild(fill);
      btn.appendChild(cloneThumb(u.def, 58));
      const hp = U.el('div', 'hp');
      const hpi = U.el('i');
      hp.appendChild(hpi);
      btn.appendChild(hp);
      btn.addEventListener('click', () => {
        if (u.energy < C.ULT_COST || u.dead || !C.canAct(u)) { Audio.play('deny'); return; }
        UI.battle.fireUlt(u);
        View.shake = 0.8;
        Audio.play('ult');
      });
      bar.appendChild(btn);
      UI._ultBtns.push({ btn, fill, hpi, u });
    });
  };

  UI.tickUltBar = function () {
    if (!UI._ultBtns) return;
    UI._ultBtns.forEach((o) => {
      const ready = o.u.energy >= C.ULT_COST && !o.u.dead;
      o.btn.classList.toggle('ready', ready && !UI.save.settings.autoUlt);
      o.btn.classList.toggle('dead', o.u.dead);
      o.fill.style.height = (U.clamp01(o.u.energy / C.ULT_COST) * 100) + '%';
      o.hpi.style.width = (U.clamp01(o.u.hp / o.u.maxHp) * 100) + '%';
      o.hpi.style.background = o.u.hp / o.u.maxHp > 0.4 ? 'var(--good)' : 'var(--danger)';
    });
  };

  UI.endBattle = function () {
    const b = UI.battle;
    const run = UI.run;
    Audio.stopMusic();
    run.recordAfterBattle(b);

    if (b.state === 'lost') {
      run.dead = true;
      UI.save.run = null;
      UI.persist();
      UI.showRunEnd(false);
      return;
    }

    const node = UI.node;
    run.winBattle();
    const gold = (node.type === 'boss' ? 200 : node.type === 'elite' ? 120 : 55) + run.goldBonus();
    run.gold += gold;
    UI._lastGold = gold;

    if (node.type === 'boss') {
      const more = run.advanceAct();
      if (!more) { UI.save.runsWon++; UI.save.run = null; UI.persist(); UI.showRunEnd(true); return; }
      UI.save.bestAct = Math.max(UI.save.bestAct, run.act);
    }
    UI.showReward(node);
  };

  // ---------------------------------------------------------------- rewards
  UI.showReward = function (node) {
    const run = UI.run;
    const choices = run.rollRewards(node);
    $('#reward-title').textContent = node.type === 'boss' ? 'Region klaret!' : 'Sejr';
    $('#reward-sub').textContent = '+' + UI._lastGold + ' guld · vælg én belønning';
    const wrap = $('#reward-choices');
    wrap.innerHTML = '';
    choices.forEach((rw) => wrap.appendChild(rewardChoice(rw, () => {
      run.takeReward(rw);
      if (rw.kind === 'recruit') UI.save.seen[rw.id] = true;
      UI.hideOverlay('reward');
      UI.afterNode();
    })));
    $('#reward-skip').onclick = () => { UI.hideOverlay('reward'); UI.afterNode(); };
    UI.overlay('reward');
    Audio.play('win');
  };

  function rewardChoice(rw, onPick) {
    const b = U.el('button', 'choice');
    b.type = 'button';
    const ico = U.el('div', 'cico');
    const txt = U.el('div', 'ctxt');
    if (rw.kind === 'recruit') {
      ico.appendChild(cloneThumb(rw.critter, 52));
      txt.appendChild(U.el('b', null, 'Hverv ' + rw.critter.name));
      txt.appendChild(U.el('span', null,
        R.ELEMENTS[rw.critter.element].name + ' ' + R.ROLES[rw.critter.role].name +
        ' · ' + rw.critter.title));
    } else if (rw.kind === 'level') {
      ico.appendChild(cloneThumb(R.get(rw.id), 52));
      txt.appendChild(U.el('b', null, rw.title));
      txt.appendChild(U.el('span', null, 'Mere liv, angreb og forsvar.'));
    } else if (rw.kind === 'relic') {
      ico.textContent = relicGlyph(rw.relic.icon);
      txt.appendChild(U.el('b', null, rw.relic.name));
      txt.appendChild(U.el('span', null, rw.relic.text));
    } else {
      ico.textContent = '💰';
      txt.appendChild(U.el('b', null, '+' + rw.amount + ' guld'));
      txt.appendChild(U.el('span', null, 'Brug det ved næste bod.'));
    }
    b.appendChild(ico); b.appendChild(txt);
    if (rw.cost != null) {
      const cost = U.el('div', 'cost', rw.cost + 'g');
      b.appendChild(cost);
    }
    b.addEventListener('click', () => { Audio.play('click'); onPick(); });
    return b;
  }

  UI.afterNode = function () {
    if (UI.node && !UI.node.cleared) { UI.node.cleared = true; UI.run.clearNode(UI.node); }
    UI.encounter = null;
    UI.battle = null;
    UI.saveRun();
    UI.show('map', { replace: true });
  };

  // ---------------------------------------------------------------- shop
  UI.renderShop = function () {
    const run = UI.run;
    if (!UI._shopItems || UI._shopNode !== UI.node) {
      UI._shopItems = run.rollShop();
      UI._shopNode = UI.node;
    }
    $('#shop-gold').textContent = run.gold;
    const grid = $('#shop-grid');
    grid.innerHTML = '';
    UI._shopItems.forEach((item, i) => {
      if (item.bought) return;
      const b = rewardChoice(item.kind === 'heal'
        ? { kind: 'gold', amount: 0, title: item.title, cost: item.cost }
        : item, () => {
        if (run.gold < item.cost) { UI.toast('Ikke guld nok'); Audio.play('deny'); return; }
        run.gold -= item.cost;
        if (item.kind === 'heal') run.restHeal(item.amount);
        else run.takeReward(item);
        if (item.kind === 'recruit') UI.save.seen[item.id] = true;
        item.bought = true;
        UI.saveRun();
        UI.renderShop();
      });
      if (item.kind === 'heal') {
        b.querySelector('.cico').textContent = '🍲';
        b.querySelector('.ctxt b').textContent = item.title;
        b.querySelector('.ctxt span').textContent = 'Giv hele holdet 50% liv tilbage.';
      }
      const cost = b.querySelector('.cost');
      if (cost) cost.textContent = item.cost + 'g';
      if (run.gold < item.cost) b.disabled = true;
      grid.appendChild(b);
    });
    if (!grid.children.length) {
      const p = U.el('p', 'panel-sub', 'Boden er tom. God rejse.');
      grid.appendChild(p);
    }
    $('#shop-leave').onclick = () => { UI._shopItems = null; UI.afterNode(); };
  };

  // ---------------------------------------------------------------- rest
  UI.renderRest = function () {
    const run = UI.run;
    const wrap = $('#rest-choices');
    wrap.innerHTML = '';
    const opts = [
      {
        icon: '🔥', title: 'Hvil', text: 'Giv hver kritter 60% liv tilbage.',
        go: () => run.restHeal(0.6),
      },
      {
        icon: '📖', title: 'Træn', text: 'Giv én kritter +3 niveauer.',
        go: () => {
          const e = run.rng.pick(run.roster);
          e.bonus = (e.bonus || 0) + 3;
          UI.toast(R.get(e.id).name + ' nåede niveau ' + run.levelOf(e));
        },
      },
      {
        icon: '🍀', title: 'Sank', text: 'Find 90 guld og få 20% liv tilbage.',
        go: () => { run.gold += 90; run.restHeal(0.2); },
      },
    ];
    opts.forEach((o) => {
      const b = U.el('button', 'choice');
      b.type = 'button';
      const ico = U.el('div', 'cico', o.icon);
      const txt = U.el('div', 'ctxt');
      txt.appendChild(U.el('b', null, o.title));
      txt.appendChild(U.el('span', null, o.text));
      b.appendChild(ico); b.appendChild(txt);
      b.addEventListener('click', () => { o.go(); Audio.play('heal'); UI.afterNode(); });
      wrap.appendChild(b);
    });
  };

  UI.openTreasure = function () {
    const run = UI.run;
    const choices = run.rollRewards({ type: 'treasure' });
    $('#reward-title').textContent = 'Fund';
    $('#reward-sub').textContent = 'Nogen efterlod noget her. Tag én ting.';
    const wrap = $('#reward-choices');
    wrap.innerHTML = '';
    choices.forEach((rw) => wrap.appendChild(rewardChoice(rw, () => {
      run.takeReward(rw);
      if (rw.kind === 'recruit') UI.save.seen[rw.id] = true;
      UI.hideOverlay('reward');
      UI.afterNode();
    })));
    $('#reward-skip').onclick = () => { UI.hideOverlay('reward'); UI.afterNode(); };
    UI.overlay('reward');
  };

  // ---------------------------------------------------------------- run end
  UI.showRunEnd = function (won) {
    const run = UI.run;
    $('#end-title').textContent = won ? 'Rejsen fuldført' : 'Rejsen er slut';
    $('#end-title').className = won ? 'win' : 'lose';
    $('#end-sub').textContent = won
      ? 'Gnavrod er fældet. Der er stille i Mumleskoven igen.'
      : 'Holdet kunne ikke holde linjen. De Skæve Lande beholder, hvad de tager.';
    const ul = $('#end-stats');
    ul.innerHTML = '';
    const row = (k, v) => {
      const li = U.el('li');
      li.appendChild(U.el('span', null, k));
      li.appendChild(U.el('b', null, String(v)));
      ul.appendChild(li);
    };
    row('Nåede til', RM.ACTS[Math.min(run.act, RM.ACTS.length - 1)].name);
    row('Kampe vundet', run.battlesWon);
    row('Kritter hvervet', run.roster.length);
    row('Relikvier fundet', run.relics.length);
    row('Guld tilbage', run.gold);
    UI.persist();
    UI.overlay('runend');
    Audio.play(won ? 'win' : 'lose');
    Audio.stopMusic();
  };

  // ---------------------------------------------------------------- codex
  UI.renderCodex = function () {
    drawWheel();
    const f = $('#codex-filters');
    if (!f.children.length) {
      const mk = (id, label, color) => {
        const b = U.el('button', 'f-pill');
        b.type = 'button';
        if (color) { const i = U.el('i'); i.style.background = color; b.appendChild(i); }
        b.appendChild(document.createTextNode(label));
        b.dataset.f = id;
        b.addEventListener('click', () => { UI.codexFilter = id; UI.renderCodex(); });
        f.appendChild(b);
      };
      mk('all', 'Alle');
      R.ELEMENT_ORDER.forEach((e) => mk(e, R.ELEMENTS[e].name, R.ELEMENTS[e].color));
    }
    $$('.f-pill', f).forEach((p) => p.classList.toggle('on', p.dataset.f === UI.codexFilter));

    const grid = $('#codex-grid');
    grid.innerHTML = '';
    R.list
      .filter((c) => UI.codexFilter === 'all' || c.element === UI.codexFilter)
      .forEach((c) => {
        const card = UI.card(c, { size: 100 });
        /* Playable critters are always legible — the Codex is a reference for
         * planning a team, and hiding your own cast from it helps nobody.
         * Wild critters and bosses stay silhouetted until you have met them. */
        if (c.enemyOnly && !UI.save.seen[c.id]) {
          card.style.filter = 'grayscale(1) brightness(.45)';
          card.title = 'Ikke mødt endnu';
        }
        card.addEventListener('click', () => UI.showDetail(c));
        grid.appendChild(card);
      });
  };

  function drawWheel() {
    const cv = $('#wheel');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = 300, h = 150;
    cv.width = w * dpr; cv.height = h * dpr;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2 + 6, rad = 52;
    const order = R.ELEMENT_ORDER;
    const pos = order.map((id, i) => {
      const a = -Math.PI / 2 + (i / order.length) * U.TAU;
      return { id, x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad };
    });
    // arrows from each element to the one it beats
    pos.forEach((p) => {
      const target = pos.find((q) => q.id === R.ELEMENTS[p.id].beats);
      if (!target) return;
      const a = U.angle(p.x, p.y, target.x, target.y);
      const sx = p.x + Math.cos(a) * 15, sy = p.y + Math.sin(a) * 15;
      const ex = target.x - Math.cos(a) * 17, ey = target.y - Math.sin(a) * 17;
      ctx.strokeStyle = U.rgba(R.ELEMENTS[p.id].color, 0.55);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = U.rgba(R.ELEMENTS[p.id].color, 0.9);
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - Math.cos(a - 0.4) * 7, ey - Math.sin(a - 0.4) * 7);
      ctx.lineTo(ex - Math.cos(a + 0.4) * 7, ey - Math.sin(a + 0.4) * 7);
      ctx.closePath(); ctx.fill();
    });
    pos.forEach((p) => {
      const el = R.ELEMENTS[p.id];
      const g = ctx.createRadialGradient(p.x - 4, p.y - 5, 1, p.x, p.y, 15);
      g.addColorStop(0, U.shade(el.color, 0.45));
      g.addColorStop(1, U.shade(el.color, -0.25));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, U.TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '700 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(el.name, p.x, p.y + 27);
    });
  }

  // ---------------------------------------------------------------- detail
  UI.showDetail = function (c) {
    const box = $('#critter-detail');
    box.innerHTML = '';
    const head = U.el('div', 'detail-head');
    const art = U.el('div', 'detail-art');
    art.style.setProperty('--grade', R.GRADE[c.grade].color);
    art.appendChild(cloneThumb(c, 104));
    head.appendChild(art);
    const idb = U.el('div', 'detail-id');
    idb.appendChild(U.el('h3', null, c.name));
    idb.appendChild(U.el('div', 'ttl', c.title));
    const tags = U.el('div', 'tagline');
    const et = U.el('span', 'tag', R.ELEMENTS[c.element].name);
    et.style.background = U.rgba(R.ELEMENTS[c.element].color, 0.25);
    et.style.borderColor = U.rgba(R.ELEMENTS[c.element].color, 0.5);
    tags.appendChild(et);
    const rt = U.el('span', 'tag', R.ROLES[c.role].name);
    rt.style.background = U.rgba(R.ROLES[c.role].color, 0.22);
    tags.appendChild(rt);
    const gt = U.el('span', 'tag', R.RARITY[c.rarity].name);
    gt.style.color = R.GRADE[c.grade].color;
    tags.appendChild(gt);
    tags.appendChild(U.el('span', 'tag', c.stats.range > 0 ? 'Afstand' : 'Nærkamp'));
    idb.appendChild(tags);
    head.appendChild(idb);
    box.appendChild(head);

    if (c.person) box.appendChild(U.el('p', 'person', c.person));
    box.appendChild(U.el('p', 'blurb', '\u201C' + c.blurb + '\u201D'));

    const run = UI.run;
    const owned = run && run.owned(c.id);
    const st = R.statsFor(c, owned && run ? run.levelOf(owned) : 1);
    const sb = U.el('div', 'statbar');
    const stat = (label, val) => {
      const d = U.el('div');
      d.appendChild(U.el('span', null, label));
      d.appendChild(U.el('b', null, String(val)));
      sb.appendChild(d);
    };
    stat('Liv', st.hp);
    stat('Angreb', st.atk);
    stat('Forsvar', st.def);
    stat('Hastighed', st.interval.toFixed(2) + 's');
    box.appendChild(sb);

    const ability = (kind, cls, name, text) => {
      const a = U.el('div', 'ability');
      const ah = U.el('div', 'ah');
      ah.appendChild(U.el('b', null, name));
      ah.appendChild(U.el('span', 'kind ' + cls, kind));
      a.appendChild(ah);
      a.appendChild(U.el('p', null, text));
      box.appendChild(a);
    };
    if (c.passive) ability('Passiv', 'kind-passive', c.passive.name, c.passive.text);
    if (c.ult) ability('Ultimate', 'kind-ult', c.ult.name, c.ult.text);
    if (c.bond) ability('Bånd', 'kind-bond', 'Side om side', c.bond.text);

    const close = U.el('button', 'btn btn-quiet', 'Luk');
    close.style.width = '100%';
    close.addEventListener('click', () => UI.hideOverlay('critter'));
    box.appendChild(close);

    UI.overlay('critter');
    Audio.play('select');
  };

  // ---------------------------------------------------------------- howto
  UI.renderHowto = function () {
    const ul = $('#howto-roles');
    if (ul.children.length) return;
    Object.values(R.ROLES).forEach((role) => {
      const li = U.el('li');
      const b = U.el('b', null, role.name + ' — ');
      b.style.color = role.color;
      li.appendChild(b);
      li.appendChild(document.createTextNode(role.blurb));
      ul.appendChild(li);
    });
  };

  // ---------------------------------------------------------------- settings
  UI.renderSettings = function () {
    const s = UI.save.settings;
    const body = $('#settings-body');
    body.innerHTML = '';
    const row = (label, hint, control) => {
      const r = U.el('div', 'set-row');
      const l = U.el('div');
      l.appendChild(U.el('div', 'lbl', label));
      if (hint) l.appendChild(U.el('div', 'hint', hint));
      r.appendChild(l);
      r.appendChild(control);
      body.appendChild(r);
    };
    const slider = (get, set) => {
      const i = U.el('input');
      i.type = 'range'; i.min = '0'; i.max = '1'; i.step = '0.05';
      i.value = String(get());
      i.addEventListener('input', () => { set(parseFloat(i.value)); });
      i.addEventListener('change', () => UI.persist());
      return i;
    };
    const toggle = (get, set) => {
      const sw = U.el('div', 'switch' + (get() ? ' on' : ''));
      sw.addEventListener('click', () => {
        set(!get());
        sw.classList.toggle('on', !!get());
        UI.persist();
        Audio.play('click');
      });
      return sw;
    };

    row('Lydeffekter', 'Slag, ultimates, sejr', slider(() => s.sfx, (v) => { s.sfx = v; Audio.setSfxVolume(v); }));
    row('Musik', 'Kampmelodi', slider(() => s.music, (v) => { s.music = v; Audio.setMusicVolume(v); }));
    row('Auto-ultimates', 'Udløs ultimates straks de er ladet op', toggle(() => s.autoUlt, (v) => { s.autoUlt = v; }));

    const sp = U.el('div', 'btn-row');
    [1, 2, 3].forEach((v) => {
      const b = U.el('button', 'btn btn-sm' + (UI.speed === v ? ' btn-primary' : ' btn-quiet'), v + '×');
      b.addEventListener('click', () => { UI.speed = v; s.speed = v; UI.persist(); UI.renderSettings(); });
      sp.appendChild(b);
    });
    row('Kamphastighed', 'Virker med det samme', sp);

    const wipe = U.el('button', 'btn btn-quiet', 'Slet al fremgang');
    wipe.style.marginTop = '18px';
    wipe.style.width = '100%';
    wipe.addEventListener('click', () => {
      if (wipe.dataset.armed) {
        U.storage.clear();
        UI.loadSave();
        UI.run = null;
        UI.toast('Fremgang slettet');
        UI.show('title', { replace: true });
      } else {
        wipe.dataset.armed = '1';
        wipe.textContent = 'Tryk igen for at bekræfte';
      }
    });
    body.appendChild(wipe);
  };

  NS.UI = UI;
})(window.COC);

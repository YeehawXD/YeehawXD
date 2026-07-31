/* Critter Clash — main.js
 * Boot, global wiring, and the handful of controls that live outside a screen.
 */
(function (NS) {
  'use strict';

  const U = NS.U;
  const $ = U.$;
  const UI = NS.UI;
  const Audio = NS.Audio;

  function wire() {
    document.addEventListener('click', (ev) => {
      const go = ev.target.closest('[data-go]');
      if (go) {
        Audio.unlock();
        switch (go.dataset.go) {
          case 'newrun':
            UI.hideOverlay('runend');
            UI.newRun();
            break;
          case 'continue': UI.continueRun(); break;
          case 'title':
            UI.hideOverlay('runend');
            UI.hideOverlay('reward');
            UI.stack = [];
            UI.show('title', { replace: true });
            Audio.stopMusic();
            Audio.play('back');
            break;
          case 'codex': UI.show('codex'); break;
          case 'howto': UI.show('howto'); break;
          case 'settings': UI.show('settings'); break;
          case 'team': UI.encounter = null; UI.show('team'); break;
          default: break;
        }
        return;
      }
      if (ev.target.closest('[data-back]')) {
        Audio.play('back');
        UI.back();
      }
    });

    $('#btn-autoform').addEventListener('click', () => {
      UI.run.autoFormation();
      UI.pick = null;
      UI.renderTeam();
      UI.saveRun();
      Audio.play('place');
    });

    $('#btn-fight').addEventListener('click', () => {
      Audio.unlock();
      if (UI.encounter) UI.startBattle();
      else UI.show('map', { replace: true });
    });

    $('#btn-speed').addEventListener('click', () => {
      UI.speed = UI.speed >= 3 ? 1 : UI.speed + 1;
      UI.save.settings.speed = UI.speed;
      UI.persist();
      $('#btn-speed').textContent = UI.speed + '×';
      Audio.play('click');
    });

    $('#btn-auto').addEventListener('click', () => {
      const s = UI.save.settings;
      s.autoUlt = !s.autoUlt;
      if (UI.battle) UI.battle.autoUlt = s.autoUlt;
      $('#btn-auto').classList.toggle('on', s.autoUlt);
      UI.persist();
      Audio.play('click');
    });

    // tapping the dim backdrop closes an overlay panel
    ['critter', 'reward'].forEach((n) => {
      const el = $('#s-' + n);
      el.addEventListener('click', (ev) => {
        if (ev.target === el && n === 'critter') UI.hideOverlay(n);
      });
    });

    window.addEventListener('resize', () => {
      if (UI.screen === 'battle') UI.resizeBattle();
    });
    if (window.ResizeObserver) {
      new ResizeObserver(() => {
        if (UI.screen === 'battle') UI.resizeBattle();
      }).observe($('#field'));
    }

    ['pointerdown', 'keydown'].forEach((e) =>
      window.addEventListener(e, () => Audio.unlock(), { once: true }));

    // don't let a stray drag scroll the page during a fight
    document.addEventListener('touchmove', (ev) => {
      if (UI.screen === 'battle') ev.preventDefault();
    }, { passive: false });

    window.addEventListener('keydown', (ev) => {
      if (UI.screen !== 'battle' || !UI._ultBtns) return;
      const n = parseInt(ev.key, 10);
      if (n >= 1 && n <= UI._ultBtns.length) UI._ultBtns[n - 1].btn.click();
    });
  }

  function boot() {
    UI.loadSave();
    NS.BattleView.attach($('#battle-canvas'));
    wire();
    UI.show('title', { replace: true });
    // warm the portrait cache so the first grid paints instantly
    requestAnimationFrame(() => {
      NS.Roster.list.forEach((c) => UI.thumb(c, 96));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.COC);

/* Clash of Critters — main.js
 * Bootstrap: load the profile, wire up global navigation, start on the menu.
 */
(function (NS) {
  'use strict';

  const U = NS.U;
  const $ = U.$, $$ = U.$$;
  const Game = NS.Game;
  const BS = NS.BattleScreen;
  const Audio = NS.Audio;

  function startRankedBattle() {
    Audio.unlock();
    BS.start({});
  }

  function wireNav() {
    document.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.dataset.act;
      Audio.unlock();
      switch (act) {
        case 'battle': startRankedBattle(); break;
        case 'menu':
          BS.stop();
          Game.hideOverlay('result');
          Game.hideOverlay('pause');
          Game.hideOverlay('carddetail');
          Game.show('menu');
          Audio.play('back');
          break;
        case 'deck': Game.show('deck'); Audio.play('click'); break;
        case 'cards': Game.show('cards'); Audio.play('click'); break;
        case 'stats': Game.show('stats'); Audio.play('click'); break;
        case 'settings': Game.show('settings'); Audio.play('click'); break;
        case 'practice': Game.show('practice'); Audio.play('click'); break;
        case 'help': Game.show('help'); Audio.play('click'); break;
        case 'rematch':
          Game.hideOverlay('result');
          if (BS.info && BS.info.practice) {
            Game.show('practice');
          } else {
            startRankedBattle();
          }
          break;
        case 'resume':
          BS.paused = false;
          Game.hideOverlay('pause');
          Audio.play('click');
          break;
        case 'forfeit':
          BS.forfeit();
          break;
        default: break;
      }
    });

    // card filters
    $('#card-filters').addEventListener('click', (ev) => {
      const p = ev.target.closest('.pill');
      if (!p) return;
      Game.cardFilter = p.dataset.filter;
      Game.renderCollection();
      Audio.play('select');
    });

    $('#deck-random').addEventListener('click', () => Game.randomDeck());

    $('#deck-copy').addEventListener('click', async () => {
      const code = Game.deckCode();
      try {
        await navigator.clipboard.writeText(code);
        Game.toast('Deck code copied');
      } catch (e) {
        window.prompt('Copy your deck code:', code);
      }
      Audio.play('click');
    });

    $('#deck-paste').addEventListener('click', async () => {
      let code = '';
      try { code = await navigator.clipboard.readText(); } catch (e) { /* fall through */ }
      if (!code) code = window.prompt('Paste a deck code:') || '';
      if (!code) return;
      if (Game.applyDeckCode(code)) Game.toast('Deck loaded');
      else { Game.toast('That deck code is not valid'); Audio.play('error'); }
    });

    // tapping the dimmed backdrop closes the card detail
    $('#s-carddetail').addEventListener('click', (ev) => {
      if (ev.target.id === 's-carddetail') Game.hideOverlay('carddetail');
    });

    // an audio context can only start from a real gesture
    ['pointerdown', 'keydown'].forEach((e) =>
      window.addEventListener(e, () => Audio.unlock(), { once: true }));

    // pause the battle when the tab goes away
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && Game.screen === 'battle' && BS.battle &&
        BS.battle.phase !== 'ended') {
        BS.paused = true;
        Game.overlay('pause');
      }
    });

    // never let a stray drag scroll the page during a battle
    document.addEventListener('touchmove', (ev) => {
      if (Game.screen === 'battle') ev.preventDefault();
    }, { passive: false });
  }

  function boot() {
    Game.load();
    BS.init();
    wireNav();
    Game.show('menu');

    // Warm the thumbnail cache so the first deck screen opens instantly.
    requestAnimationFrame(() => {
      NS.Cards.list.forEach((c) => NS.Render.cardThumb(c, 100));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window.COC);

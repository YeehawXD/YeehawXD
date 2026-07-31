/* Clash of Critters — audio.js
 * All sound is synthesised with the WebAudio API: zero asset downloads,
 * works offline, and every effect is a few lines of code.
 */
window.COC = window.COC || {};
(function (NS) {
  'use strict';

  const U = NS.U;

  const Audio = {
    ctx: null,
    master: null,
    sfxGain: null,
    musicGain: null,
    enabled: true,
    sfxVolume: 0.7,
    musicVolume: 0.35,
    _musicTimer: null,
    _musicStep: 0,
    _unlocked: false,
  };

  function ensure() {
    if (Audio.ctx) return Audio.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    Audio.ctx = new AC();
    Audio.master = Audio.ctx.createGain();
    Audio.master.gain.value = 1;
    Audio.master.connect(Audio.ctx.destination);

    Audio.sfxGain = Audio.ctx.createGain();
    Audio.sfxGain.gain.value = Audio.sfxVolume;
    Audio.sfxGain.connect(Audio.master);

    Audio.musicGain = Audio.ctx.createGain();
    Audio.musicGain.gain.value = Audio.musicVolume;
    Audio.musicGain.connect(Audio.master);
    return Audio.ctx;
  }

  Audio.unlock = function () {
    const ctx = ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    Audio._unlocked = true;
  };

  Audio.setSfxVolume = function (v) {
    Audio.sfxVolume = v;
    if (Audio.sfxGain) Audio.sfxGain.gain.value = v;
  };
  Audio.setMusicVolume = function (v) {
    Audio.musicVolume = v;
    if (Audio.musicGain) Audio.musicGain.gain.value = v;
  };

  // --------------------------------------------------------------- helpers
  function now() { return Audio.ctx.currentTime; }

  function tone(opts) {
    if (!Audio.enabled || !Audio._unlocked) return;
    const ctx = ensure();
    if (!ctx) return;
    const t0 = now() + (opts.delay || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.freqTo != null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.freqTo), t0 + opts.dur);
    }
    const peak = (opts.gain == null ? 0.3 : opts.gain);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + (opts.attack || 0.008));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);

    let node = osc;
    if (opts.filter) {
      const f = ctx.createBiquadFilter();
      f.type = opts.filter;
      f.frequency.value = opts.filterFreq || 1200;
      if (opts.filterQ) f.Q.value = opts.filterQ;
      node.connect(f);
      node = f;
    }
    node.connect(gain);
    gain.connect(opts.music ? Audio.musicGain : Audio.sfxGain);
    osc.start(t0);
    osc.stop(t0 + opts.dur + 0.05);
  }

  let noiseBuf = null;
  function noise(opts) {
    if (!Audio.enabled || !Audio._unlocked) return;
    const ctx = ensure();
    if (!ctx) return;
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.0, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t0 = now() + (opts.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = opts.filter || 'bandpass';
    f.frequency.setValueAtTime(opts.freq || 900, t0);
    if (opts.freqTo != null) f.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqTo), t0 + opts.dur);
    f.Q.value = opts.q == null ? 1 : opts.q;
    const g = ctx.createGain();
    const peak = opts.gain == null ? 0.25 : opts.gain;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + (opts.attack || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    src.connect(f); f.connect(g); g.connect(Audio.sfxGain);
    src.start(t0);
    src.stop(t0 + opts.dur + 0.05);
  }

  // --------------------------------------------------------------- sfx
  const SFX = {
    click() { tone({ type: 'triangle', freq: 660, freqTo: 880, dur: 0.08, gain: 0.18 }); },
    back() { tone({ type: 'triangle', freq: 480, freqTo: 300, dur: 0.1, gain: 0.16 }); },
    error() { tone({ type: 'square', freq: 180, freqTo: 120, dur: 0.16, gain: 0.14 }); },
    deny() { tone({ type: 'square', freq: 200, freqTo: 130, dur: 0.14, gain: 0.12 }); },
    select() { tone({ type: 'sine', freq: 880, dur: 0.06, gain: 0.14 }); },
    place() {
      tone({ type: 'triangle', freq: 420, freqTo: 700, dur: 0.1, gain: 0.16 });
      noise({ freq: 900, freqTo: 300, dur: 0.09, gain: 0.07, filter: 'lowpass' });
    },
    start() {
      [392, 523, 659, 784].forEach((f, i) =>
        tone({ type: 'triangle', freq: f, dur: 0.3, gain: 0.16, delay: i * 0.08 }));
    },
    /* The ultimate is the one moment the player caused, so it gets the biggest
       sound in the game: a rising sweep plus a low impact. */
    ult() {
      tone({ type: 'sawtooth', freq: 260, freqTo: 1300, dur: 0.32, gain: 0.16, filter: 'lowpass', filterFreq: 2600 });
      tone({ type: 'sine', freq: 140, freqTo: 60, dur: 0.42, gain: 0.24, delay: 0.16 });
      noise({ freq: 2200, freqTo: 500, dur: 0.4, gain: 0.14, delay: 0.14 });
    },

    deploy() {
      tone({ type: 'sine', freq: 300, freqTo: 620, dur: 0.16, gain: 0.22 });
      noise({ freq: 500, freqTo: 200, dur: 0.2, gain: 0.12, filter: 'lowpass' });
    },
    spawn() { tone({ type: 'triangle', freq: 520, freqTo: 760, dur: 0.12, gain: 0.15 }); },

    hitMelee() {
      noise({ freq: 1600, freqTo: 400, dur: 0.09, gain: 0.16, q: 0.8 });
      tone({ type: 'square', freq: 160, freqTo: 90, dur: 0.07, gain: 0.08 });
    },
    hitArrow() { noise({ freq: 2600, freqTo: 900, dur: 0.07, gain: 0.1, q: 2 }); },
    shootArrow() { noise({ freq: 1800, freqTo: 3000, dur: 0.06, gain: 0.07, q: 3 }); },
    shootMagic() { tone({ type: 'sawtooth', freq: 720, freqTo: 1400, dur: 0.11, gain: 0.08, filter: 'lowpass', filterFreq: 2400 }); },

    explode() {
      noise({ freq: 800, freqTo: 60, dur: 0.5, gain: 0.32, filter: 'lowpass', q: 0.6 });
      tone({ type: 'sine', freq: 120, freqTo: 40, dur: 0.4, gain: 0.24 });
    },
    zap() {
      tone({ type: 'sawtooth', freq: 1800, freqTo: 200, dur: 0.14, gain: 0.16 });
      noise({ freq: 3000, freqTo: 600, dur: 0.12, gain: 0.14, q: 1 });
    },
    freeze() {
      tone({ type: 'sine', freq: 1400, freqTo: 2600, dur: 0.35, gain: 0.12 });
      tone({ type: 'sine', freq: 2100, freqTo: 3200, dur: 0.3, gain: 0.07, delay: 0.05 });
    },
    heal() {
      [523, 659, 784].forEach((f, i) => tone({ type: 'sine', freq: f, dur: 0.28, gain: 0.1, delay: i * 0.06 }));
    },
    arrowsVolley() { noise({ freq: 2200, freqTo: 700, dur: 0.3, gain: 0.14, q: 1.5 }); },

    unitDie() {
      tone({ type: 'triangle', freq: 420, freqTo: 120, dur: 0.22, gain: 0.16 });
      noise({ freq: 700, freqTo: 200, dur: 0.18, gain: 0.08, filter: 'lowpass' });
    },
    towerHit() {
      noise({ freq: 500, freqTo: 160, dur: 0.16, gain: 0.16, filter: 'lowpass' });
      tone({ type: 'square', freq: 110, freqTo: 70, dur: 0.12, gain: 0.1 });
    },
    towerDown() {
      noise({ freq: 900, freqTo: 50, dur: 0.9, gain: 0.4, filter: 'lowpass', q: 0.5 });
      [220, 165, 110].forEach((f, i) => tone({ type: 'sawtooth', freq: f, freqTo: f * 0.5, dur: 0.5, gain: 0.14, delay: i * 0.09 }));
    },

    elixirFull() { [880, 1174].forEach((f, i) => tone({ type: 'sine', freq: f, dur: 0.14, gain: 0.1, delay: i * 0.07 })); },
    doubleElixir() { [440, 554, 659, 880].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.2, gain: 0.13, delay: i * 0.09 })); },

    win() { [523, 659, 784, 1046].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.45, gain: 0.2, delay: i * 0.13 })); },
    lose() { [523, 466, 392, 311].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.5, gain: 0.18, delay: i * 0.15 })); },
    draw() { [523, 587, 523].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.35, gain: 0.16, delay: i * 0.14 })); },
    crown() { [784, 1046, 1318].forEach((f, i) => tone({ type: 'sine', freq: f, dur: 0.3, gain: 0.16, delay: i * 0.08 })); },
    countdown() { tone({ type: 'square', freq: 660, dur: 0.12, gain: 0.14 }); },
    go() { tone({ type: 'square', freq: 990, freqTo: 1320, dur: 0.3, gain: 0.18 }); },
    emote() { tone({ type: 'triangle', freq: 700, freqTo: 1100, dur: 0.14, gain: 0.14 }); },
  };

  Audio.play = function (name) {
    const fn = SFX[name];
    if (fn) { try { fn(); } catch (e) { /* audio is never fatal */ } }
  };

  // --------------------------------------------------------------- music
  // A short looping chiptune arpeggio; deliberately low-key so it sits under sfx.
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16];
  const PROG = [
    [0, 4, 7], [-3, 0, 4], [-5, -1, 2], [-3, 0, 4],
    [0, 4, 7], [2, 5, 9], [-5, -1, 2], [-1, 2, 7],
  ];
  const midi = (n) => 220 * Math.pow(2, n / 12);

  Audio.startMusic = function (tempo) {
    if (!Audio.enabled) return;
    ensure();
    Audio.stopMusic();
    const beat = 60 / (tempo || 108) / 2;
    Audio._musicStep = 0;
    Audio._musicTimer = setInterval(function () {
      if (!Audio._unlocked || !Audio.enabled) return;
      const s = Audio._musicStep++;
      const chord = PROG[Math.floor(s / 8) % PROG.length];
      const n = chord[s % 3];
      tone({ type: 'triangle', freq: midi(n + 12), dur: beat * 1.7, gain: 0.05, music: true });
      if (s % 8 === 0) tone({ type: 'sine', freq: midi(n - 12), dur: beat * 3.4, gain: 0.09, music: true });
      if (s % 4 === 2) tone({ type: 'sine', freq: midi(SCALE[(s / 2) % SCALE.length]), dur: beat, gain: 0.03, music: true });
    }, beat * 1000);
  };

  Audio.stopMusic = function () {
    if (Audio._musicTimer) { clearInterval(Audio._musicTimer); Audio._musicTimer = null; }
  };

  Audio.vibrate = function (pattern) {
    if (Audio.haptics && navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (e) { /* ignore */ }
    }
  };
  Audio.haptics = true;

  NS.Audio = Audio;
})(window.COC);

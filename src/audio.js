/* =========================================================================
   NORBERT, UNFINISHED  --  audio.js
   Every sound in this game is synthesised at runtime. There are no audio
   files. The squelches are filtered noise with a falling pitch envelope, the
   score is a small generative music box, and each character "speaks" in blips
   tuned to their personality (Gary is a smug oboe, Beans is one flat bloop).
   ========================================================================= */

const Sound = {
  ctx: null, master: null, musicGain: null, sfxGain: null,
  ready: false, muted: false,
  _noise: null,
  _music: null,
  _next: 0, _step: 0, _timer: null,
  volMusic: 0.5, volSfx: 0.75,
};

Sound.init = function () {
  if (Sound.ready) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const ctx = Sound.ctx = new AC();
  Sound.master = ctx.createGain(); Sound.master.gain.value = 0.9;
  Sound.master.connect(ctx.destination);

  /* a touch of room, so the craft room sounds like a room */
  const conv = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * 1.1);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * 0.55;
    }
  }
  conv.buffer = buf;
  const wet = ctx.createGain(); wet.gain.value = 0.20;
  conv.connect(wet); wet.connect(Sound.master);
  Sound.verb = conv;

  Sound.musicGain = ctx.createGain(); Sound.musicGain.gain.value = Sound.volMusic;
  Sound.musicGain.connect(Sound.master); Sound.musicGain.connect(conv);
  Sound.sfxGain = ctx.createGain(); Sound.sfxGain.gain.value = Sound.volSfx;
  Sound.sfxGain.connect(Sound.master);
  const sfxVerb = ctx.createGain(); sfxVerb.gain.value = 0.5;
  Sound.sfxGain.connect(sfxVerb); sfxVerb.connect(conv);

  /* one second of noise, reused forever */
  const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const nd = nb.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  Sound._noise = nb;

  Sound.ready = true;
  Sound._next = ctx.currentTime + 0.1;
  Sound._timer = setInterval(Sound._schedule, 26);
};

Sound.resume = function () {
  if (!Sound.ready) Sound.init();
  if (Sound.ctx && Sound.ctx.state === 'suspended') Sound.ctx.resume();
};

/* Safari on iOS keeps a fresh AudioContext suspended until something is
   actually played from inside a user gesture, so play one silent sample. */
Sound.unlock = function () {
  Sound.resume();
  if (!Sound.ctx) return;
  try {
    const b = Sound.ctx.createBuffer(1, 1, 22050);
    const s = Sound.ctx.createBufferSource();
    s.buffer = b;
    s.connect(Sound.ctx.destination);
    s.start(0);
  } catch (e) { /* already running */ }
  if (Sound._pending) { const k = Sound._pending; Sound._pending = null; Sound.music(k); }
};

Sound.setMuted = function (m) {
  Sound.muted = m;
  if (Sound.master) Sound.master.gain.setTargetAtTime(m ? 0 : 0.9, Sound.ctx.currentTime, 0.05);
};

/* ---- little synth voices --------------------------------------------- */

function _env(g, t, a, d, peak) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function _tone(freq, t, dur, type, vol, dest, slideTo) {
  const c = Sound.ctx;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  _env(g, t, Math.min(0.012, dur * 0.2), dur, vol);
  o.connect(g); g.connect(dest || Sound.sfxGain);
  o.start(t); o.stop(t + dur + 0.06);
  return { o, g };
}

function _noiseBurst(t, dur, vol, f0, f1, q, dest) {
  const c = Sound.ctx;
  const s = c.createBufferSource();
  s.buffer = Sound._noise;
  s.loop = true;
  s.playbackRate.value = 0.8 + Math.random() * 0.5;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass'; bp.Q.value = q || 1.4;
  bp.frequency.setValueAtTime(f0, t);
  bp.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  const g = c.createGain();
  _env(g, t, 0.006, dur, vol);
  s.connect(bp); bp.connect(g); g.connect(dest || Sound.sfxGain);
  s.start(t); s.stop(t + dur + 0.05);
}

/* ---- the sound effect list -------------------------------------------- */

const SFX = {
  /* the core noise of this entire game */
  squelch(t, p) {
    const v = (p && p.vol) || 0.5;
    const pitch = (p && p.pitch) || 1;
    _noiseBurst(t, 0.16, 0.3 * v, 900 * pitch, 180 * pitch, 1.1);
    _tone(300 * pitch, t, 0.13, 'sine', 0.22 * v, null, 90 * pitch);
    _tone(180 * pitch, t + 0.02, 0.10, 'triangle', 0.12 * v, null, 70 * pitch);
  },
  step(t, p) {
    const pitch = 0.8 + Math.random() * 0.5;
    _noiseBurst(t, 0.07, 0.13, 700 * pitch, 220 * pitch, 1.6);
    _tone(150 * pitch, t, 0.055, 'sine', 0.09, null, 80);
  },
  jump(t) {
    _tone(220, t, 0.2, 'sine', 0.20, null, 520);
    _noiseBurst(t, 0.1, 0.13, 500, 1400, 1.0);
  },
  land(t, p) {
    const v = (p && p.vol) || 1;
    _noiseBurst(t, 0.15, 0.24 * v, 620, 110, 1.0);
    _tone(120, t, 0.14, 'sine', 0.24 * v, null, 55);
  },
  tear(t) {
    _noiseBurst(t, 0.26, 0.30, 1600, 420, 2.2);
    _tone(420, t, 0.22, 'triangle', 0.14, null, 150);
  },
  lob(t) {
    _tone(360, t, 0.15, 'sine', 0.20, null, 760);
    _noiseBurst(t, 0.12, 0.10, 900, 2200, 1.2);
  },
  slurp(t) {
    _noiseBurst(t, 0.30, 0.24, 260, 1700, 3.4);
    _tone(140, t, 0.28, 'sine', 0.16, null, 620);
  },
  splat(t) {
    _noiseBurst(t, 0.22, 0.34, 1200, 130, 0.9);
    _tone(240, t, 0.18, 'sine', 0.22, null, 60);
  },
  plink(t, p) {
    const f = (p && p.freq) || 900;
    _tone(f, t, 0.5, 'sine', 0.18);
    _tone(f * 2.01, t, 0.3, 'sine', 0.07);
  },
  chime(t) {
    [0, 4, 7, 12].forEach((s, i) => _tone(523.25 * Math.pow(2, s / 12), t + i * 0.06, 1.3, 'sine', 0.14 - i * 0.02));
  },
  sad(t) {
    [0, -3, -5].forEach((s, i) => _tone(392 * Math.pow(2, s / 12), t + i * 0.14, 0.9, 'triangle', 0.13));
  },
  pop(t) {
    _tone(700 + Math.random() * 400, t, 0.06, 'sine', 0.2, null, 200);
  },
  ui(t) { _tone(660, t, 0.09, 'square', 0.05); _tone(990, t + 0.02, 0.09, 'sine', 0.07); },
  uiBig(t) { _tone(523, t, 0.14, 'triangle', 0.10); _tone(784, t + 0.06, 0.3, 'sine', 0.10); },
  whoosh(t) { _noiseBurst(t, 0.4, 0.14, 200, 2600, 0.7); },
  thud(t) { _tone(70, t, 0.4, 'sine', 0.4, null, 38); _noiseBurst(t, 0.3, 0.2, 300, 60, 0.8); },
  drip(t) { _tone(1400, t, 0.13, 'sine', 0.14, null, 500); },
  bubble(t) { _tone(300 + Math.random() * 500, t, 0.14, 'sine', 0.10, null, 1200); },
  fire(t) { _noiseBurst(t, 0.7, 0.10, 120, 700, 0.5); },
  wire(t) { _tone(1800, t, 0.18, 'triangle', 0.07, null, 2400); },
  shrink(t) { _tone(500, t, 0.5, 'sine', 0.18, null, 180); _noiseBurst(t, 0.4, 0.12, 800, 200, 1.4); },
  grow(t) { _tone(180, t, 0.5, 'sine', 0.18, null, 620); },
};

Sound.play = function (name, opts) {
  if (!Sound.ready || Sound.muted) return;
  const fn = SFX[name];
  if (!fn) return;
  fn(Sound.ctx.currentTime + 0.001, opts);
};

/* Character voice blips. Everyone speaks in beeps; the beeps have a soul. */
const VOICES = {
  norbert: { f: 300, type: 'sine', jit: 90, dur: 0.07, vol: 0.10 },
  gary: { f: 210, type: 'square', jit: 30, dur: 0.055, vol: 0.045 },
  pippa: { f: 520, type: 'triangle', jit: 200, dur: 0.09, vol: 0.07 },
  steve: { f: 130, type: 'sawtooth', jit: 18, dur: 0.075, vol: 0.035 },
  beans: { f: 155, type: 'sine', jit: 0, dur: 0.16, vol: 0.13 },
  glaze: { f: 660, type: 'sine', jit: 8, dur: 0.06, vol: 0.06 },
  council: { f: 240, type: 'square', jit: 120, dur: 0.05, vol: 0.05 },
  thumb: { f: 55, type: 'sine', jit: 6, dur: 0.4, vol: 0.22 },
  narrator: { f: 380, type: 'sine', jit: 40, dur: 0.05, vol: 0.045 },
};

Sound.blip = function (who) {
  if (!Sound.ready || Sound.muted) return;
  const v = VOICES[who] || VOICES.narrator;
  const t = Sound.ctx.currentTime + 0.001;
  const f = v.f + (Math.random() - 0.5) * v.jit;
  _tone(f, t, v.dur, v.type, v.vol);
  if (v.type !== 'sine') _tone(f * 2, t, v.dur * 0.6, 'sine', v.vol * 0.4);
};

/* ---- the music box ---------------------------------------------------- */

/* Each track: a key, a set of chords (semitones from the key), and a texture.
   The sequencer walks 16th notes and asks the track what to do with each. */
const TRACKS = {
  sill: {
    bpm: 74, root: 55, // G
    chords: [[0, 4, 7, 11], [-3, 2, 5, 9], [-5, 0, 4, 7], [2, 5, 9, 12]],
    arp: [0, 2, 1, 3, 2, 1], arpEvery: 2, bell: 0.10, padVol: 0.055, bassVol: 0.10,
  },
  table: {
    bpm: 88, root: 58, // Bb
    chords: [[0, 3, 7, 10], [-2, 3, 5, 10], [-4, 0, 3, 7], [-2, 2, 5, 9]],
    arp: [0, 1, 2, 3, 2, 1], arpEvery: 2, bell: 0.095, padVol: 0.05, bassVol: 0.11, pluck: true,
  },
  paint: {
    bpm: 104, root: 62, // D
    chords: [[0, 4, 7, 14], [5, 9, 12, 16], [-3, 4, 7, 12], [2, 7, 11, 14]],
    arp: [0, 2, 3, 1, 2, 0], arpEvery: 1, bell: 0.085, padVol: 0.04, bassVol: 0.10, pluck: true,
  },
  sink: {
    bpm: 66, root: 51, // Eb
    chords: [[0, 3, 7, 10], [-5, 2, 7, 10], [-2, 3, 6, 10], [0, 5, 7, 12]],
    arp: [0, 3, 1, 2], arpEvery: 3, bell: 0.075, padVol: 0.07, bassVol: 0.09, drip: true,
  },
  kiln: {
    bpm: 96, root: 49, // Db
    chords: [[0, 3, 7], [1, 5, 8], [-1, 3, 6], [0, 4, 7]],
    arp: [0, 1, 2, 1], arpEvery: 1, bell: 0.06, padVol: 0.10, bassVol: 0.15, tense: true,
  },
  dawn: {
    bpm: 60, root: 60, // C
    chords: [[0, 4, 7, 11], [-3, 2, 5, 9], [-5, 0, 4, 9], [-1, 2, 7, 11]],
    arp: [0, 1, 2, 3, 2, 1], arpEvery: 2, bell: 0.12, padVol: 0.075, bassVol: 0.08,
  },
  title: {
    bpm: 70, root: 57,
    chords: [[0, 3, 7, 10], [-2, 3, 7, 12], [-4, 0, 3, 8], [-5, 2, 7, 10]],
    arp: [0, 2, 1, 3], arpEvery: 2, bell: 0.115, padVol: 0.065, bassVol: 0.10,
  },
};

function midi2f(m) { return 440 * Math.pow(2, (m - 69) / 12); }

Sound.music = function (key) {
  if (!Sound.ready) { Sound._pending = key; return; }
  if (Sound._musicKey === key) return;
  Sound._musicKey = key;
  const trk = TRACKS[key];
  Sound._music = trk || null;
  Sound._step = 0;
  Sound._next = Sound.ctx.currentTime + 0.05;
  /* dip the volume through the change so it doesn't snap */
  const g = Sound.musicGain.gain, now = Sound.ctx.currentTime;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(0.0001, now + 0.35);
  g.linearRampToValueAtTime(Sound.volMusic, now + 1.4);
};

Sound.stopMusic = function () {
  if (!Sound.ready) return;
  Sound._musicKey = null; Sound._music = null;
  const g = Sound.musicGain.gain, now = Sound.ctx.currentTime;
  g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(0.0001, now + 0.6);
};

Sound._schedule = function () {
  if (!Sound.ready || !Sound._music) return;
  const c = Sound.ctx;
  const trk = Sound._music;
  const spb = 60 / trk.bpm / 4;         // one sixteenth
  while (Sound._next < c.currentTime + 0.2) {
    const t = Sound._next;
    const s = Sound._step;
    const bar = Math.floor(s / 16) % trk.chords.length;
    const chord = trk.chords[bar];
    const beat = s % 16;

    /* bass on 1 and (softly) on the and-of-3 */
    if (beat === 0 || beat === 11) {
      const f = midi2f(trk.root + chord[0] - 12);
      const o = c.createOscillator(); o.type = 'triangle';
      o.frequency.value = f;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
      const g = c.createGain();
      const v = trk.bassVol * (beat === 0 ? 1 : 0.45);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (beat === 0 ? 1.5 : 0.6));
      o.connect(lp); lp.connect(g); g.connect(Sound.musicGain);
      o.start(t); o.stop(t + 1.7);
    }

    /* the music box: sine bells with a fast decay and an octave shimmer */
    if (s % trk.arpEvery === 0) {
      const idx = Math.floor(s / trk.arpEvery) % trk.arp.length;
      let deg = trk.arp[idx];
      const oct = (Math.floor(s / 16) % 2) && idx === 0 ? 12 : 0;
      const note = trk.root + chord[deg % chord.length] + 12 + oct;
      const f = midi2f(note);
      const dur = 1.5;
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2.004;
      const g = c.createGain(); const g2 = c.createGain();
      const v = trk.bell * (idx === 0 ? 1 : 0.66);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.exponentialRampToValueAtTime(v * 0.30, t + 0.005);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.35);
      o.connect(g); o2.connect(g2);
      g.connect(Sound.musicGain); g2.connect(Sound.musicGain);
      o.start(t); o.stop(t + dur + 0.1);
      o2.start(t); o2.stop(t + dur * 0.4 + 0.1);
    }

    /* pad: two detuned saws under a slow filter, felt more than heard */
    if (beat === 0) {
      for (let i = 0; i < chord.length; i++) {
        const f = midi2f(trk.root + chord[i]);
        for (const det of [-4, 4]) {
          const o = c.createOscillator(); o.type = 'sawtooth';
          o.frequency.value = f; o.detune.value = det;
          const lp = c.createBiquadFilter(); lp.type = 'lowpass';
          lp.frequency.setValueAtTime(320, t);
          lp.frequency.linearRampToValueAtTime(760, t + 1.2);
          lp.Q.value = 2;
          const g = c.createGain();
          const dur = spb * 16;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(trk.padVol / chord.length, t + dur * 0.35);
          g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.02);
          o.connect(lp); lp.connect(g); g.connect(Sound.musicGain);
          o.start(t); o.stop(t + dur * 1.1);
        }
      }
    }

    /* texture per room */
    if (trk.pluck && (beat === 6 || beat === 14)) {
      const f = midi2f(trk.root + chord[(beat / 2) % chord.length] + 24);
      _tone(f, t, 0.25, 'triangle', 0.035, Sound.musicGain);
    }
    if (trk.drip && beat === 8 && Math.random() > 0.4) {
      _tone(1500, t, 0.16, 'sine', 0.035, Sound.musicGain, 620);
    }
    if (trk.tense && (beat === 0 || beat === 8)) {
      const s2 = c.createBufferSource(); s2.buffer = Sound._noise; s2.loop = true;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 90; bp.Q.value = 0.6;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      s2.connect(bp); bp.connect(g); g.connect(Sound.musicGain);
      s2.start(t); s2.stop(t + 1);
    }

    Sound._next += spb;
    Sound._step++;
  }
};

/* =========================================================================
   NORBERT, UNFINISHED  --  levels.js
   Six rooms, and everything anybody says in them.

   Maps are built from surface spans rather than hand-drawn ASCII, because
   hand-drawn ASCII is how you end up with a hole in the floor of chapter four
   that nobody finds until launch day.
   ========================================================================= */

/* ground: [x0, x1, surfaceRow]  (surfaceRow < 0 means "no floor here")
   solid:  [x0, y0, x1, y1]      filled with '#'
   plat:   [x0, x1, row]         one-way lolly sticks
   water:  [x0, x1, topRow, botRow]
   heat:   [x0, x1, topRow, botRow]
   carve:  [x0, y0, x1, y1]      punched back out to empty                */
function buildMap(w, h, spec) {
  const g = [];
  for (let y = 0; y < h; y++) g.push(new Array(w).fill(' '));
  const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = c; };

  for (const s of (spec.ground || [])) {
    const [x0, x1, row] = s;
    if (row < 0) continue;
    for (let x = x0; x <= x1; x++) for (let y = row; y < h; y++) put(x, y, '#');
  }
  for (const s of (spec.solid || [])) {
    const [x0, y0, x1, y1] = s;
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) put(x, y, '#');
  }
  for (const s of (spec.carve || [])) {
    const [x0, y0, x1, y1] = s;
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) put(x, y, ' ');
  }
  for (const s of (spec.water || [])) {
    const [x0, x1, y0, y1] = s;
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) put(x, y, '~');
  }
  for (const s of (spec.heat || [])) {
    const [x0, x1, y0, y1] = s;
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) put(x, y, '*');
  }
  for (const s of (spec.plat || [])) {
    const [x0, x1, row] = s;
    for (let x = x0; x <= x1; x++) put(x, row, '=');
  }
  return g.map(r => r.join(''));
}

/* tiny helpers for writing script */
const N = (text, o) => Object.assign({ who: 'norbert', text }, o);
const say = (who, text, o) => Object.assign({ who, text }, o);
const card = (text, o) => Object.assign({ who: 'narrator', text, name: '', style: 'soft', auto: 2.2 }, o);

const LEVELS = {};

/* ======================================================================= */
/*  CHAPTER ONE -- THE WINDOWSILL                                          */
/* ======================================================================= */

/* Reachability rules every map below obeys, so the game is always completable:
     - a gap is at most 3 tiles wide          (a run-up jump clears 103px)
     - a pit floor is exactly 2 rows down     (64px, so you can always get out)
     - a step up is 2 tiles                   (jump) or exactly 3 (stretch-flop)
     - long vertical climbs use one-way lolly sticks, never solid ledges,
       because solid ledges two rows apart leave no headroom to stand up in  */

LEVELS.sill = {
  id: 'sill', theme: 'sill', chapter: 'ONE', title: 'The Windowsill', clock: '5:04 pm',
  next: 'table',
  spawn: { x: 3.5, y: 11 },
  tiles: buildMap(80, 15, {
    ground: [
      [0, 13, 11], [14, 16, 13], [17, 27, 11],
      [28, 38, 11], [39, 50, 8], [51, 54, -1], [55, 66, 9], [67, 79, 11],
    ],
    /* the overhang you have to squash under */
    solid: [[22, 0, 25, 9], [39, 0, 41, 4], [63, 0, 66, 6]],
    plat: [[51, 54, 9]],
  }),
  deco: [
    { k: 'pencil', x: 120, y: 300, rot: -0.1, len: 150, color: '#e0b73c', layer: 'back' },
    { k: 'eraser', x: 300, y: 340, w: 24, h: 13 },
    { k: 'paperclip', x: 620, y: 344, rot: 0.2 },
    { k: 'button', x: 840, y: 342, r: 12, color: '#7ab0c4' },
    { k: 'thread', x: 980, y: 250, len: 260, color: '#c85a7a', ph: 1, drop: 60, layer: 'back' },
    { k: 'bead', x: 1180, y: 344, r: 7, color: '#5aa8c8' },
    { k: 'bead', x: 1196, y: 346, r: 5, color: '#c8a05a' },
    { k: 'crumple', x: 1500, y: 236, r: 24 },
    { k: 'domino', x: 1760, y: 262, n: 5 },
    { k: 'cotton', x: 2050, y: 274, r: 18 },
    { k: 'pencil', x: 2180, y: 330, rot: 0.06, len: 130, color: '#4a7ec0', layer: 'fore', alpha: 0.9 },
  ],
  objects: [
    { t: 'sign', x: 6, y: 11, opts: { text: 'THE WINDOWSILL|pop. 6' } },
    { t: 'sign', x: 19, y: 11, opts: { text: 'MIND|YOUR HEAD' } },
    { t: 'pot', x: 18, y: 11 },
    { t: 'item', x: 15, y: 13, opts: { icon: 'eye', label: 'a spare googly eye', eye: true } },
    { t: 'sign', x: 36, y: 11, opts: { text: 'STRETCH|to climb' } },
    { t: 'npc', kind: 'gary', x: 32, y: 11, id: 'gary' },
    { t: 'pot', x: 42, y: 8 },
    { t: 'item', x: 47, y: 8, opts: { icon: 'eye', label: 'a spare googly eye', eye: true } },
    { t: 'item', x: 60, y: 9, opts: { icon: 'sequin', label: 'one sequin', eye: true } },
    { t: 'exit', x: 76, y: 11, opts: { wid: 3, hgt: 4, to: 'table' } },
    {
      t: 'trigger', x: 28, y: 6, w: 4, h: 6, id: 'meetgary',
      act: (G) => G.say(SCRIPTS.garyMeet),
    },
    {
      t: 'trigger', x: 19, y: 9, w: 2, h: 3, id: 'squishTip',
      act: (G) => G.tip('Hold  DOWN  to squash flat', 3.6),
    },
    {
      t: 'trigger', x: 36, y: 8, w: 2, h: 4, id: 'stretchTip',
      act: (G) => G.tip('Hold  UP  facing a ledge, then JUMP, to pour yourself over it', 5),
    },
    {
      t: 'trigger', x: 72, y: 8, w: 3, h: 4, id: 'ch1end',
      act: (G) => G.say(SCRIPTS.ch1End),
    },
  ],
  intro: [
    card('Tuesday. 4:58 pm. Craft Club is over.'),
    card('A girl called Ivy made you out of one lump of terracotta and forty minutes.'),
    card('She ran out of both.'),
  ],
};

/* ======================================================================= */
/*  CHAPTER TWO -- THE GREAT TABLE                                         */
/* ======================================================================= */

LEVELS.table = {
  id: 'table', theme: 'table', chapter: 'TWO', title: 'The Great Table', clock: '7:20 pm',
  next: 'paint',
  spawn: { x: 3, y: 12 },
  tiles: buildMap(126, 17, {
    ground: [
      [0, 20, 12], [21, 23, -1], [24, 44, 12],
      [45, 47, -1], [48, 58, 12],
      [59, 61, -1], [62, 86, 12],
      [87, 89, -1], [90, 105, 12],
      [106, 108, -1], [109, 125, 12],
    ],
    solid: [
      [21, 14, 23, 16], [45, 14, 47, 16], [59, 14, 61, 16],
      [87, 14, 89, 16], [106, 14, 108, 16],
      [30, 0, 33, 7],            /* a shelf edge hanging over the table */
      [70, 9, 76, 9],            /* a lip you can only reach by stretching */
      [99, 0, 101, 6],
    ],
    plat: [[36, 41, 9], [66, 69, 10], [93, 97, 9]],
  }),
  deco: [
    { k: 'splat', x: 260, y: 380, r: 26, color: '#3f8ac9' },
    { k: 'splat', x: 700, y: 382, r: 18, color: '#c94f6b' },
    { k: 'pencil', x: 420, y: 330, rot: -0.5, len: 170, color: '#c94f4f', layer: 'back' },
    { k: 'crumple', x: 900, y: 356, r: 28 },
    { k: 'paperclip', x: 1560, y: 376, rot: -0.4 },
    { k: 'brush', x: 1180, y: 384, rot: -1.35, len: 110, color: '#3fb2c9', layer: 'back' },
    { k: 'domino', x: 2050, y: 358, n: 3 },
    { k: 'domino', x: 2082, y: 360, n: 6 },
    { k: 'thread', x: 2300, y: 230, len: 340, color: '#e0c04a', ph: 0.4, drop: 110, layer: 'back' },
    { k: 'button', x: 2660, y: 376, r: 15, color: '#d2a05a' },
    { k: 'eraser', x: 2960, y: 372, w: 30, h: 15 },
    { k: 'cotton', x: 3340, y: 356, r: 22 },
    { k: 'splat', x: 3600, y: 382, r: 30, color: '#5fc46b' },
  ],
  objects: [
    { t: 'sign', x: 4, y: 12, opts: { text: 'THE GREAT TABLE|(watch your step)' } },
    { t: 'pot', x: 8, y: 12 },
    {
      t: 'trigger', x: 14, y: 8, w: 3, h: 5, id: 'springTip',
      act: (G) => G.tip('Hold DOWN to wind up, then JUMP for a BIG one', 4.4),
    },

    /* --- LOB tutorial: a plate you cannot possibly stand on and reach --- */
    { t: 'sign', x: 27, y: 12, opts: { text: 'PRESS AND HOLD|(good luck)' } },
    { t: 'plate', x: 31, y: 12, id: 'p1', opts: { wid: 2 } },
    { t: 'gate', x: 41, y: 12, id: 'g1', opts: { plates: ['p1'], hgt: 4, wid: 2, color: '#8a6a44' } },
    {
      t: 'trigger', x: 25, y: 8, w: 2, h: 5, id: 'lobTip',
      act: (G) => { G.canLob = true; G.say(SCRIPTS.lobTip); },
    },
    { t: 'item', x: 38, y: 9, opts: { icon: 'eye', label: 'a spare googly eye', eye: true } },

    { t: 'pot', x: 50, y: 12 },
    { t: 'item', x: 54, y: 12, opts: { icon: 'eye', label: 'a spare googly eye', eye: true } },

    /* --- Beans --- */
    { t: 'npc', kind: 'beans', x: 66, y: 12, id: 'beans', opts: { autoFace: false, facing: 1 } },
    {
      t: 'trigger', x: 63, y: 8, w: 3, h: 5, id: 'meetbeans',
      act: (G) => G.say(SCRIPTS.beansMeet),
    },
    { t: 'item', x: 73, y: 9, opts: { icon: 'eye', label: 'a spare googly eye', eye: true } },

    /* --- THE THUMB --- */
    {
      t: 'trigger', x: 79, y: 6, w: 3, h: 7, id: 'thumb',
      act: (G) => G.thumbScene(),
    },

    /* --- two plates at once: two pieces of yourself --- */
    { t: 'sign', x: 91, y: 12, opts: { text: 'BOTH|AT ONCE' } },
    { t: 'plate', x: 94, y: 12, id: 'p2', opts: { wid: 2 } },
    { t: 'plate', x: 101, y: 12, id: 'p3', opts: { wid: 2 } },
    { t: 'gate', x: 112, y: 12, id: 'g2', opts: { plates: ['p2', 'p3'], hgt: 4, wid: 2, color: '#8a6a44' } },

    { t: 'pot', x: 116, y: 12 },
    { t: 'npc', kind: 'pippa', x: 120, y: 12, id: 'pippa', opts: { hasLeg: false } },
    {
      t: 'trigger', x: 117, y: 7, w: 3, h: 6, id: 'meetpippa',
      act: (G) => G.say(SCRIPTS.pippaMeet),
    },
    { t: 'exit', x: 124, y: 12, opts: { wid: 2, hgt: 5, to: 'paint', needFlag: 'pippaDone' } },
  ],
  intro: [card('THE GREAT TABLE'), card('Four feet across. Three days since anybody wiped it.')],
};

/* ======================================================================= */
/*  CHAPTER THREE -- THE PAINT SHELF                                       */
/* ======================================================================= */

LEVELS.paint = {
  id: 'paint', theme: 'paint', chapter: 'THREE', title: 'The Paint Shelf', clock: '11:47 pm',
  next: 'sink',
  spawn: { x: 3, y: 13 },
  tiles: buildMap(114, 18, {
    ground: [
      [0, 16, 13], [17, 19, -1], [20, 33, 13],
      [34, 36, -1], [37, 46, 10],
      [47, 49, -1], [50, 64, 13],
      [65, 67, -1], [68, 80, 10],
      [81, 83, -1], [84, 98, 13],
      [99, 101, -1], [102, 113, 13],
    ],
    solid: [
      [17, 15, 19, 17], [34, 15, 36, 17], [47, 15, 49, 17],
      [65, 15, 67, 17], [81, 15, 83, 17], [99, 15, 101, 17],
      [42, 6, 45, 6], [73, 6, 76, 6],
    ],
    /* stepping stones up onto the two high shelves */
    plat: [[34, 36, 11], [65, 67, 11], [28, 31, 10], [88, 91, 10]],
  }),
  deco: [
    { k: 'splat', x: 200, y: 412, r: 34, color: '#d94f9c' },
    { k: 'splat', x: 760, y: 414, r: 28, color: '#3fb2c9' },
    { k: 'splat', x: 1500, y: 414, r: 30, color: '#e8c33f' },
    { k: 'brush', x: 980, y: 414, rot: -1.1, len: 120, color: '#d94f9c' },
    { k: 'brush', x: 2100, y: 320, rot: -1.5, len: 130, color: '#5fc46b', layer: 'back' },
    { k: 'crumple', x: 1750, y: 300, r: 26, color: '#f0d8e8' },
    { k: 'thread', x: 2700, y: 220, len: 300, color: '#9a5fd9', ph: 2, drop: 120, layer: 'back' },
    { k: 'cotton', x: 3200, y: 400, r: 20 },
  ],
  objects: [
    { t: 'sign', x: 5, y: 13, opts: { text: 'THE PAINT SHELF|WIPE YOUR FEET' } },
    { t: 'pot', x: 9, y: 13 },

    { t: 'vat', x: 12, y: 13, id: 'vC', opts: { wid: 3, color: '#3fb2c9', label: 'CYAN!' } },
    { t: 'sign', x: 21, y: 13, opts: { text: 'CYAN ONLY|no exceptions' } },
    { t: 'gate', x: 24, y: 13, id: 'gC', opts: { needColor: '#3fb2c9', hgt: 4, wid: 2, color: '#2f7f92' } },

    { t: 'npc', kind: 'glaze', x: 30, y: 13, id: 'glaze' },
    {
      t: 'trigger', x: 27, y: 8, w: 3, h: 6, id: 'meetglaze',
      act: (G) => G.say(SCRIPTS.glazeMeet),
    },

    { t: 'vat', x: 39, y: 10, id: 'vM', opts: { wid: 3, color: '#d94f9c', label: 'MAGENTA!' } },
    { t: 'item', x: 44, y: 10, opts: { icon: 'eye', label: 'a spare googly eye', eye: true } },
    { t: 'pot', x: 52, y: 13 },
    { t: 'sign', x: 55, y: 13, opts: { text: 'MAGENTA ONLY|we are very strict' } },
    { t: 'gate', x: 58, y: 13, id: 'gM', opts: { needColor: '#d94f9c', hgt: 4, wid: 2, color: '#8f3466' } },

    { t: 'vat', x: 71, y: 10, id: 'vY', opts: { wid: 3, color: '#e8c33f', label: 'YELLOW!' } },
    { t: 'item', x: 77, y: 10, opts: { icon: 'eye', label: 'a spare googly eye', eye: true } },
    { t: 'sign', x: 88, y: 13, opts: { text: 'YELLOW ONLY|(the good yellow)' } },
    { t: 'gate', x: 93, y: 13, id: 'gY', opts: { needColor: '#e8c33f', hgt: 4, wid: 2, color: '#a08422' } },

    { t: 'vat', x: 96, y: 13, id: 'vP', opts: { wid: 3, color: '#7a6250', label: 'PUCE.' } },
    { t: 'sign', x: 95, y: 13, opts: { text: 'PUCE|nobody has ever|asked for puce' } },

    { t: 'pot', x: 105, y: 13 },
    {
      t: 'trigger', x: 104, y: 8, w: 3, h: 6, id: 'glaze2',
      act: (G) => G.say(SCRIPTS.glazeSecond),
    },
    { t: 'exit', x: 111, y: 13, opts: { wid: 2, hgt: 5, to: 'sink' } },
  ],
  intro: [card('THE PAINT SHELF'), card('Where they keep the colours, and the opinions about colours.')],
};

/* ======================================================================= */
/*  CHAPTER FOUR -- THE SINK                                               */
/* ======================================================================= */

LEVELS.sink = {
  id: 'sink', theme: 'sink', chapter: 'FOUR', title: 'The Sink', clock: '2:15 am',
  next: 'kiln',
  spawn: { x: 3, y: 11 },
  tiles: buildMap(114, 19, {
    ground: [
      [0, 18, 11], [19, 27, -1], [28, 42, 11],
      [43, 51, -1], [52, 66, 11],
      [67, 75, -1], [76, 90, 11],
      [91, 99, -1], [100, 113, 11],
    ],
    solid: [[0, 17, 113, 18], [36, 6, 39, 6], [60, 6, 63, 6], [84, 6, 87, 6]],
    water: [[19, 27, 14, 16], [43, 51, 14, 16], [67, 75, 14, 16], [91, 99, 14, 16]],
    plat: [[32, 35, 8], [56, 59, 8], [104, 107, 8]],
  }),
  deco: [
    { k: 'bead', x: 300, y: 348, r: 6, color: '#8ab8c8' },
    { k: 'cotton', x: 700, y: 330, r: 24 },
    { k: 'paperclip', x: 1000, y: 340, rot: 0.9 },
    { k: 'crumple', x: 1900, y: 330, r: 22, color: '#d8e4ea' },
    { k: 'bead', x: 1180, y: 348, r: 7, color: '#c8b06a' },
    { k: 'bead', x: 1196, y: 350, r: 5, color: '#7ab0c4' },
    { k: 'cotton', x: 1290, y: 332, r: 17 },
    { k: 'splat', x: 1420, y: 350, r: 20, color: '#5a8fa8' },
    { k: 'crumple', x: 2560, y: 330, r: 19, color: '#cfe0e8' },
    { k: 'thread', x: 2400, y: 180, len: 320, color: '#7ab0c4', ph: 1.2, drop: 90, layer: 'back' },
    { k: 'cotton', x: 2700, y: 330, r: 20 },
    { k: 'splat', x: 3300, y: 348, r: 24, color: '#4a7a92' },
  ],
  objects: [
    { t: 'sign', x: 5, y: 11, opts: { text: 'THE SINK|DO NOT DRINK' } },
    { t: 'pot', x: 8, y: 11 },
    {
      t: 'trigger', x: 15, y: 7, w: 3, h: 5, id: 'waterTip',
      act: (G) => G.say(SCRIPTS.waterTip),
    },

    /* crossing one: sponges only */
    { t: 'sponge', x: 20, y: 13, opts: { wid: 2, depth: 30 } },
    { t: 'sponge', x: 23, y: 13, opts: { wid: 2, depth: 30 } },
    { t: 'sponge', x: 26, y: 13, opts: { wid: 2, depth: 30 } },

    { t: 'npc', kind: 'steve', x: 35, y: 11, id: 'steve', opts: { scale: 1.15 } },
    {
      t: 'trigger', x: 31, y: 6, w: 3, h: 6, id: 'meetsteve',
      act: (G) => G.say(SCRIPTS.steveMeet),
    },
    { t: 'pot', x: 40, y: 11 },

    /* crossing two: a soap jet in the middle you can plug with a piece of you */
    { t: 'sponge', x: 44, y: 13, opts: { wid: 2, depth: 30 } },
    { t: 'sponge', x: 47, y: 13, opts: { wid: 2, depth: 30 } },
    { t: 'sponge', x: 50, y: 13, opts: { wid: 2, depth: 30 } },
    { t: 'spout', x: 47, y: 15, opts: { dir: 'up', len: 5, color: '#dff0f8' } },

    { t: 'pot', x: 56, y: 11 },
    { t: 'item', x: 58, y: 8, opts: { icon: 'eye', label: 'a spare googly eye', eye: true } },

    /* crossing three */
    { t: 'sponge', x: 68, y: 13, opts: { wid: 2, depth: 30 } },
    { t: 'sponge', x: 71, y: 13, opts: { wid: 2, depth: 30 } },
    { t: 'sponge', x: 74, y: 13, opts: { wid: 2, depth: 30 } },
    { t: 'spout', x: 71, y: 15, opts: { dir: 'up', len: 5, color: '#dff0f8' } },

    { t: 'pot', x: 80, y: 11 },
    { t: 'npc', kind: 'beans', x: 86, y: 11, id: 'beans2', opts: { autoFace: false, facing: -1 } },
    {
      t: 'trigger', x: 82, y: 6, w: 3, h: 6, id: 'beans2t',
      act: (G) => G.say(SCRIPTS.beansSink),
    },

    /* crossing four */
    { t: 'sponge', x: 92, y: 13, opts: { wid: 2, depth: 30 } },
    { t: 'sponge', x: 95, y: 13, opts: { wid: 2, depth: 30 } },
    { t: 'sponge', x: 98, y: 13, opts: { wid: 2, depth: 30 } },

    /* THE DRAIN */
    {
      t: 'trigger', x: 103, y: 6, w: 4, h: 6, id: 'drain',
      act: (G) => G.say(SCRIPTS.drain),
    },
    { t: 'pot', x: 108, y: 11 },
    { t: 'exit', x: 112, y: 11, opts: { wid: 2, hgt: 5, to: 'kiln', needFlag: 'drainDone' } },
  ],
  intro: [card('THE SINK'), card('Nobody comes down here on purpose.')],
};

/* ======================================================================= */
/*  CHAPTER FIVE -- THE KILN ROOM                                          */
/* ======================================================================= */

/* The climb is a scaffold of lolly sticks. One-way platforms are the only
   sane way to build a tall shaft: solid ledges stacked two rows apart leave
   nowhere to stand up straight. */
const KILN_CLIMB = (() => {
  const cols = [[2, 14], [12, 25], [23, 35]];
  const order = [0, 1, 2, 1];
  const plat = [];
  for (let i = 0; i < 16; i++) {
    const row = 38 - i * 2;
    const c = cols[order[i % order.length]];
    plat.push([c[0], c[1], row]);
  }
  plat.push([2, 37, 6]);        /* THE DRYING RACK, top of the shaft */
  return plat;
})();

LEVELS.kiln = {
  id: 'kiln', theme: 'kiln', chapter: 'FIVE', title: 'The Kiln Room', clock: '5:58 am',
  next: 'dawn',
  spawn: { x: 4, y: 41 },
  tiles: buildMap(40, 44, {
    ground: [[0, 15, 41], [16, 23, -1], [24, 39, 41]],
    solid: [
      [0, 42, 39, 43],
      [0, 0, 0, 43], [39, 0, 39, 43],
    ],
    heat: [[16, 23, 40, 41]],
    plat: KILN_CLIMB,
  }),
  deco: [
    { k: 'splat', x: 300, y: 1310, r: 22, color: '#8a3a22' },
    { k: 'crumple', x: 700, y: 1180, r: 20, color: '#c8a89a' },
    { k: 'domino', x: 900, y: 860, n: 6 },
    { k: 'bead', x: 420, y: 660, r: 7, color: '#c86a4a' },
  ],
  objects: [
    { t: 'sign', x: 3, y: 41, opts: { text: 'THE KILN ROOM|STAFF ONLY' } },
    { t: 'pot', x: 6, y: 41 },
    {
      t: 'trigger', x: 10, y: 37, w: 4, h: 5, id: 'kilnIn',
      act: (G) => G.say(SCRIPTS.kilnEnter),
    },
    { t: 'updraft', x: 16, y: 41, opts: { wid: 8, hgt: 10 } },
    { t: 'pot', x: 5, y: 30 },
    { t: 'lid', x: 27, y: 27, opts: { wid: 3, amp: 30, spd: 1.1, color: '#b4483c' } },
    { t: 'lid', x: 4, y: 19, opts: { wid: 3, amp: 26, spd: 1.5, color: '#4c7ab4' } },
    { t: 'item', x: 26, y: 25, opts: { icon: 'eye', label: 'a spare googly eye', eye: true } },
    { t: 'pot', x: 14, y: 22, opts: {} },
    { t: 'item', x: 6, y: 13, opts: { icon: 'eye', label: 'a spare googly eye', eye: true } },
    { t: 'pot', x: 17, y: 14 },
    { t: 'sign', x: 26, y: 6, opts: { text: 'FIRING AT NINE|no refunds' } },

    /* the top: the Council of Crafts */
    { t: 'npc', kind: 'gary', x: 7, y: 6, id: 'gary2' },
    { t: 'npc', kind: 'volcano', x: 12, y: 6, id: 'volcano', opts: { scale: 0.75 } },
    { t: 'npc', kind: 'sock', x: 18, y: 6, id: 'sock' },
    { t: 'npc', kind: 'macaroni', x: 22, y: 6, id: 'mac' },
    { t: 'npc', kind: 'glaze', x: 30, y: 6, id: 'glaze3' },
    {
      t: 'trigger', x: 8, y: 3, w: 4, h: 3, id: 'council',
      act: (G) => G.say(SCRIPTS.council),
    },
    { t: 'exit', x: 34, y: 6, opts: { wid: 3, hgt: 5, to: 'dawn', needFlag: 'councilDone' } },
  ],
  intro: [card('THE KILN ROOM'), card('Nine a.m. is in three hours and two minutes.')],
};

/* ======================================================================= */
/*  CHAPTER SIX -- DAWN                                                    */
/* ======================================================================= */

LEVELS.dawn = {
  id: 'dawn', theme: 'dawn', chapter: 'SIX', title: 'Dawn', clock: '6:41 am',
  next: null,
  spawn: { x: 3, y: 11 },
  tiles: buildMap(64, 14, {
    ground: [[0, 63, 11]],
    solid: [[46, 0, 48, 6]],
  }),
  deco: [
    { k: 'pencil', x: 400, y: 330, rot: -0.05, len: 150, color: '#e0b73c', layer: 'back' },
    { k: 'button', x: 700, y: 344, r: 14, color: '#c4a07a' },
    { k: 'cotton', x: 1000, y: 330, r: 20 },
    { k: 'crumple', x: 1300, y: 330, r: 22 },
    { k: 'bead', x: 1600, y: 346, r: 6, color: '#c8a05a' },
  ],
  objects: [
    { t: 'npc', kind: 'gary', x: 8, y: 11, id: 'garyEnd', opts: { autoFace: true } },
    { t: 'npc', kind: 'pippa', x: 13, y: 11, id: 'pippaEnd', opts: { hasLeg: false, clayLeg: true } },
    { t: 'npc', kind: 'steve', x: 18, y: 11, id: 'steveEnd', opts: { mood: 'warm', scale: 1.15 } },
    { t: 'npc', kind: 'beans', x: 23, y: 11, id: 'beansEnd', opts: { autoFace: false, facing: 1 } },
    {
      t: 'trigger', x: 26, y: 7, w: 3, h: 5, id: 'goodbye',
      act: (G) => G.say(SCRIPTS.goodbye),
    },
    {
      t: 'trigger', x: 52, y: 6, w: 4, h: 6, id: 'finale',
      act: (G) => G.finale(),
    },
  ],
  intro: [card('Wednesday. 6:41 am.'), card('Nobody exploded.')],
};

/* ======================================================================= */
/*  THE SCRIPT                                                             */
/* ======================================================================= */

const SCRIPTS = {

  garyMeet: [
    say('gary', 'HALT.'),
    say('gary', 'You are entering the sovereign Windowsill, of which I am — and I want to be very clear about this — the Mayor.'),
    say('gary', 'There was an election. I ran it. I was extremely fair.'),
    N('...'),
    say('gary', 'Gary. Pinecone. Pleasure.'),
    say('gary', 'Now then. You are new, you are terracotta, and you are —'),
    say('gary', '...oh.'),
    say('gary', 'Oh dear. Oh, that\'s not good at all.'),
    say('gary', 'You\'re not finished.'),
    N('?'),
    say('gary', 'Tomorrow at nine, everything on the drying rack goes into the kiln. Everything comes out FINISHED. Hard. Permanent. Real.'),
    say('gary', 'It is the happiest day of your life. Everyone says so.'),
    say('gary', 'I have never met anybody who has actually had one, but everyone says so.'),
    say('gary', 'Only — and I say this with enormous affection —'),
    say('gary', 'an unfinished piece has air trapped inside it. And air, at nine hundred degrees, would very much like to be somewhere else.'),
    say('gary', 'You would come out of that kiln as eleven pieces and a fine, disappointing dust.'),
    N('!!!', { style: 'shout' }),
    say('gary', 'So! You have until nine a.m. to finish yourself.'),
    say('gary', 'Find an arm. Find a face. Find a name. Down the ruler, across the table, past the paint, and DO NOT go in the sink.'),
    say('gary', 'Off you pop. I\'d come, but I have a great deal of standing here to do.'),
  ],

  ch1End: [
    say('gary', 'Oh — one more thing!', { name: 'GARY (distant)' }),
    say('gary', 'When you meet people down there, and they ask what you are —'),
    say('gary', 'don\'t say "unfinished". It upsets them.'),
    say('gary', 'Say "in progress". It\'s the same thing, but it makes them feel included.'),
  ],

  lobTip: [
    card('You have four handfuls of yourself.'),
    card('You can throw one. It will stick where it lands, and it will be heavy, and it will still be you.'),
    card('J or Z to tear a piece off.   K or X to slurp it back.'),
  ],

  beansMeet: [
    say('beans', 'beans'),
    N('...'),
    say('beans', 'beans'),
    N('...?'),
    say('beans', 'beans.'),
    card('You get the strong impression this is the whole thing.'),
    {
      who: 'norbert', text: 'What do you say to that?', name: '', style: 'soft',
      choice: [
        { text: 'beans', then: [
          N('beans.'),
          say('beans', 'BEANS!'),
          card('Something enormous has happened between you two and you will never be able to explain it to anyone.'),
          { act: 'beansfriend' },
        ] },
        { text: '...beans?', then: [
          N('...beans?'),
          say('beans', 'beans...'),
          card('He looks away. You have said it wrong. You will think about this for the rest of the night.'),
          { act: 'beansfriend' },
        ] },
        { text: 'say nothing', then: [
          card('You say nothing. Beans respects this enormously.'),
          say('beans', 'beans'),
          { act: 'beansfriend' },
        ] },
      ],
    },
  ],

  thumbIntro: [
    card('Something changes about the light.'),
  ],
  thumbAfter: [
    say('gary', 'THAT WAS THE THUMB.', { name: 'GARY (very far away)' }),
    say('gary', 'DID YOU SEE IT? THAT WAS THE THUMB!'),
    say('gary', 'It comes down about once a week. It made all of us. It made the table. It probably made the sky.'),
    say('gary', 'Nobody knows what it wants. Once it took Kevin.'),
    say('gary', 'We assume Kevin is fine.'),
  ],

  pippaMeet: [
    say('pippa', 'Do NOT look at me.'),
    say('pippa', 'I said do not — oh, you\'re LOOKING.'),
    N('...'),
    say('pippa', 'Fine. FINE. Look. Drink it in.'),
    say('pippa', 'Madame Pippa Pipecleaner. Principal dancer of the Windowsill Ballet. One entire glorious afternoon.'),
    say('pippa', 'And then the hoover came, darling. The HOOVER.'),
    say('pippa', 'One leg. ONE. You cannot dance Swan Lake on one leg. You can make a STATEMENT on one leg. It is not the same.'),
    card('Norbert looks down at himself. He has four handfuls. He needs all of them.'),
    card('Probably.'),
    {
      who: 'norbert', text: '', name: '',
      choice: [
        { text: 'Tear off a leg for her', then: [
          { act: 'givePippa' },
          say('pippa', '...'),
          say('pippa', 'You\'d give me a piece of you. Off your own actual person. With your hands.'),
          say('pippa', 'Darling, that is the single most revolting thing anybody has ever done for me.'),
          say('pippa', 'I accept. Immediately. Don\'t make it weird.'),
          card('It does not match. It is orange, and lumpy, and slightly too short.'),
          card('She has never looked better and she knows it.'),
          say('pippa', 'Go on then. Go and get finished, you horrible generous little thing.'),
          say('pippa', 'And if anybody down there asks — you got that limp in the ballet.'),
        ] },
        { text: 'Just... stand there', then: [
          card('You just stand there.'),
          say('pippa', 'Yes. Yes, that\'s what everyone does.'),
          card('You could stand here all night. You suspect she would let you.'),
          { act: 'pippaLoop' },
        ] },
      ],
    },
  ],

  glazeMeet: [
    say('glaze', 'Oh!'),
    say('glaze', 'Oh, you poor thing.'),
    say('glaze', 'No — no, don\'t apologise. You can\'t help it. Nobody chooses to come out like that.'),
    N('...'),
    say('glaze', 'Glaze. Porcelain. Fired at twelve hundred, glazed twice, and — I don\'t say this to boast — completely symmetrical.'),
    say('glaze', 'And I would LOVE to help you. I\'m very good at helping.'),
    say('glaze', 'A little smoothing here. Fill in that dent in your forehead. Two matching eyes — wouldn\'t that be restful? Two of the same?'),
    say('glaze', 'And then the kiln, and then you\'d be finished, and then you\'d be lovely.'),
    say('glaze', 'You\'d be exactly like me.'),
    card('Norbert puts a hand over the dent in his forehead. He isn\'t sure why.'),
    say('glaze', 'Think about it! I\'ll be around. I\'m always around.'),
  ],

  glazeSecond: [
    say('glaze', 'Still orange, then.'),
    say('glaze', 'And now you\'re — what is that, is that YELLOW? On top of the orange?'),
    say('glaze', 'Oh, sweetheart.'),
    say('glaze', 'I don\'t understand you. I have been NICE to you. I have never once been unkind.'),
    say('glaze', 'I have only ever offered to make you better.'),
    N('...'),
    say('glaze', '...'),
    say('glaze', 'Oh. Oh, I see.'),
    say('glaze', 'You don\'t want to be better. You want to be YOURS.'),
    say('glaze', 'How embarrassing for you.'),
    card('She turns away, perfectly.'),
    say('glaze', '...Nobody has ever chosen that in front of me before.', { style: 'soft' }),
  ],

  waterTip: [
    card('Water. Actual water.'),
    card('You are clay. You have been clay for four hours and you already understand exactly what water means.'),
    card('Do not fall in. The sponges float. Mostly.'),
  ],

  steveMeet: [
    say('steve', 'Don\'t.'),
    N('...'),
    say('steve', 'Whatever you were going to say. Don\'t.'),
    say('steve', '...'),
    say('steve', 'Fine. Yes. I\'ve been fired. Yes, I\'m finished. No, it is not what you think.'),
    say('steve', 'Look at me. Go on. Look at the handle.'),
    say('steve', 'Look where the handle IS.'),
    N('!'),
    say('steve', 'It\'s on the INSIDE, mate.'),
    say('steve', 'Nine hundred degrees. Twelve hours. And I came out of there permanent, unchangeable, and forever — wrong.'),
    say('steve', 'That\'s the bit nobody puts on the poster. You don\'t get FIXED after. You get KEPT.'),
    say('steve', 'Whatever you are at 8:59, you\'re that forever.'),
    card('Steve looks at the dent in Norbert\'s forehead for a long moment.'),
    say('steve', '...You\'re still soft.'),
    say('steve', 'Do you have any idea how many of us would give a handle for that?'),
    say('steve', 'Go on. Sponges are that way. Try not to dissolve, it\'s depressing to watch.'),
  ],

  beansSink: [
    say('beans', 'beans!'),
    card('Beans is on the wrong side of the drain, and the water is going down, and Beans does not appear to have a plan.'),
    say('beans', 'beans?'),
    say('beans', '...beans.'),
    card('That one sounded different.'),
  ],

  drain: [
    say('steve', 'Oh, you\'re joking.', { name: 'STEVE' }),
    say('steve', 'The plughole. Of course it\'s the plughole.'),
    say('steve', 'It\'s pulling the whole basin down and your green friend is sat right next to it saying his word.'),
    say('steve', 'You want to stop a drain, you need something soft enough to squeeze in and heavy enough to stay.'),
    say('steve', 'Which is a very long way of saying: you need clay.'),
    card('Norbert has three handfuls of himself left. He counts them twice, which does not help.'),
    {
      who: 'norbert', text: '', name: '',
      choice: [
        { text: 'Plug the drain', then: [
          { act: 'plugDrain' },
          card('It goes in with a sound like the world\'s last word.'),
          card('The water stops.'),
          say('beans', 'beans', { name: 'BEANS' }),
          say('beans', 'beans.'),
          say('steve', '...You gave up a piece of yourself. Permanently. For a lump that says one word.'),
          say('steve', 'You absolute idiot.'),
          say('steve', '...'),
          say('steve', 'Go on. Get up to the kiln room. Before I say something kind.'),
        ] },
        { text: 'Look at Beans', then: [
          card('You look at Beans.'),
          say('beans', 'beans'),
          card('Beans looks back.'),
          card('This resolves nothing, but it clarifies everything.'),
          { act: 'drainAgain' },
        ] },
      ],
    },
  ],

  kilnEnter: [
    card('It is very warm in here.'),
    card('The rack goes all the way up. Squash down, hold it, and jump.'),
    card('Not dangerous-warm. Worse. Comfortable-warm. Like somebody has already made the decision for you.'),
  ],

  council: [
    say('council', 'NEXT.'),
    say('council', 'Name?'),
    N('...'),
    say('council', 'No name. Lovely. Registrar, note it down.'),
    say('council', 'NOTED.', { name: 'THE MACARONI', pt: 3 }),
    say('council', 'MAY I ERUPT.', { name: 'VESUVIUS', pt: 6 }),
    say('council', 'Not yet, Vesuvius.'),
    say('council', 'I HAVE BEEN PREPARING.', { name: 'VESUVIUS', pt: 6 }),
    say('council', 'We know.'),
    say('council', 'Right. Present yourself for firing. State your condition.'),
    say('gary', 'He\'s IN PROGRESS!', { name: 'GARY' }),
    say('gary', 'I taught him that. He\'s in progress. Very fashionable.'),
    say('council', 'He\'s UNFINISHED, Gary.'),
    say('glaze', 'He is. But he doesn\'t have to be.', { name: 'GLAZE' }),
    say('glaze', 'Give me twenty minutes and a wet sponge and I will hand you the most beautiful thing on this table.'),
    say('glaze', 'Smooth. Even. Two matching eyes. He\'ll go in at nine and he\'ll come out perfect and he will never have to be looked at like that again.'),
    say('council', 'That seems generous.'),
    say('council', 'Well. There it is. Last item on the agenda before nine.'),
    say('council', 'Do you want to be finished?'),
    card('Everyone on the shelf goes quiet. Even Vesuvius, who has been preparing.'),
    {
      who: 'norbert', text: '', name: '',
      choice: [
        { text: 'No.', then: [
          { act: 'refuse' },
          say('council', '...'),
          say('council', 'Registrar, is he allowed to say that?'),
          say('council', 'CHECKING.', { name: 'THE MACARONI', pt: 3 }),
          say('council', '...'),
          say('council', 'THERE IS NOTHING IN THE RULES ABOUT IT.', { name: 'THE MACARONI', pt: 3 }),
          say('council', 'BECAUSE NOBODY HAS EVER SAID NO.', { name: 'THE MACARONI', pt: 3 }),
          say('glaze', 'You\'ll stay soft. Do you understand that? You\'ll stay soft forever.', { name: 'GLAZE' }),
          say('glaze', 'Anything could happen to you.'),
          N('yes', { style: 'shout' }),
          say('glaze', '...'),
          card('Glaze does not have a face that can do this. She tries anyway.'),
          say('gary', 'MAY I SAY SOMETHING.', { name: 'GARY' }),
          say('gary', 'As Mayor.'),
          say('gary', 'I have been fired. Sorry — I have not been fired. I have been GLUED, which I understand is different.'),
          say('gary', 'My point stands.'),
          say('council', 'Vesuvius.'),
          say('council', 'YES.', { name: 'VESUVIUS', pt: 6 }),
          say('council', 'You may erupt.'),
          { act: 'erupt' },
          card('It is baking soda and vinegar and it goes everywhere and it is the most beautiful thing anyone here has ever seen.'),
        ] },
        { text: 'Yes.', then: [
          card('You open your mouth to say yes.'),
          card('And you think about Steve\'s handle, on the inside, forever.'),
          card('And you find that you cannot.'),
          say('council', 'Take your time.'),
          { act: 'councilAgain' },
        ] },
      ],
    },
  ],

  goodbye: [
    say('gary', 'Well.', { name: 'GARY' }),
    say('gary', 'You\'re still soft.'),
    say('gary', 'You\'re smaller than you were, you\'re four different colours, you have somebody else\'s sequin stuck to your head, and you are STILL SOFT.'),
    say('pippa', 'He gave me a LEG, Gary.', { name: 'MME. PIPPA' }),
    say('pippa', 'I have told everyone. I will keep telling everyone. I will tell people who have already been told.'),
    say('steve', 'He plugged a drain with his own arm for a lump that says one word.', { name: 'STEVE' }),
    say('steve', 'I\'ve been on this table nine years. That\'s the stupidest thing I\'ve ever seen.'),
    say('steve', '...'),
    say('steve', 'Don\'t let anyone fire you, kid.'),
    say('beans', 'beans', { name: 'BEANS' }),
    card('The door handle turns.'),
  ],
};

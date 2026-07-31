/* Critter Clash — roster.js
 * Elements, roles, the 15 playable critters, plus enemy-only units and bosses.
 *
 * Design notes
 *  - Five elements in one cycle: tide > ember > bloom > stone > spark > tide.
 *    Advantage is worth 1.5x damage AND 50% more ultimate energy, so type
 *    matching is a tempo decision, not just a damage number.
 *  - Five roles, three critters each, so every element has a distinct shape.
 *  - Every critter has a BOND: a bonus for standing next to the right ally.
 *    That is what turns the 3x2 formation into an actual puzzle.
 */
window.COC = window.COC || {};
(function (NS) {
  'use strict';

  // ---------------------------------------------------------------- elements
  const ELEMENTS = {
    tide: { id: 'tide', name: 'Tide', color: '#3fa9e0', glow: '#8fdcff', beats: 'ember', icon: 'drop' },
    ember: { id: 'ember', name: 'Ember', color: '#ef6b3f', glow: '#ffb27a', beats: 'bloom', icon: 'flame' },
    bloom: { id: 'bloom', name: 'Bloom', color: '#5fbf4a', glow: '#a8e86a', beats: 'stone', icon: 'leaf' },
    stone: { id: 'stone', name: 'Stone', color: '#c08a4a', glow: '#e8c48a', beats: 'spark', icon: 'rock' },
    spark: { id: 'spark', name: 'Spark', color: '#e8bd2a', glow: '#ffe98a', beats: 'tide', icon: 'bolt' },
  };
  const ELEMENT_ORDER = ['tide', 'ember', 'bloom', 'stone', 'spark'];

  /** 1.5 with advantage, 0.7 against, 1 otherwise. */
  function elementMult(a, d) {
    if (!a || !d || a === d) return 1;
    if (ELEMENTS[a].beats === d) return 1.5;
    if (ELEMENTS[d].beats === a) return 0.7;
    return 1;
  }

  // ---------------------------------------------------------------- roles
  const ROLES = {
    guardian: {
      id: 'guardian', name: 'Guardian', color: '#7f9fd8',
      blurb: 'Soaks damage on the front row and keeps the back row alive.',
      base: { hp: 300, atk: 17, def: 16, interval: 1.5, range: 0 },
    },
    striker: {
      id: 'striker', name: 'Striker', color: '#e0705f',
      blurb: 'Melee damage. Fragile, but ends fights quickly.',
      base: { hp: 165, atk: 36, def: 6, interval: 1.05, range: 0 },
    },
    marksman: {
      id: 'marksman', name: 'Marksman', color: '#d8a83f',
      blurb: 'Ranged damage from the back row. Needs a wall in front.',
      base: { hp: 125, atk: 32, def: 4, interval: 1.3, range: 1 },
    },
    mender: {
      id: 'mender', name: 'Mender', color: '#5fc98a',
      blurb: 'Heals and shields. Wins long fights on its own.',
      base: { hp: 140, atk: 13, def: 6, interval: 1.6, range: 1 },
    },
    trickster: {
      id: 'trickster', name: 'Trickster', color: '#b07fd8',
      blurb: 'Slows, stuns and steals. Turns a losing fight around.',
      base: { hp: 150, atk: 23, def: 6, interval: 1.2, range: 1 },
    },
  };

  // ---------------------------------------------------------------- roster
  const list = [];
  const def = (c) => { list.push(c); return c; };

  // ============================================================ BLOOM
  def({
    id: 'pip', name: 'Pip', element: 'bloom', role: 'striker', grade: 'C',
    title: 'Sprout Scrapper',
    blurb: 'A leaf-eared scamp who has never once backed down from something larger than itself.',
    passive: { name: 'Second Sprout', text: 'Recovers 8% of max health whenever it lands a killing blow.' },
    ult: {
      name: 'Leaf Pounce', cost: 100,
      text: 'Vaults over the front line and strikes the weakest enemy for 260% attack.',
      target: 'weakestEnemy', effect: [{ kind: 'damage', mult: 2.6 }, { kind: 'leap' }],
    },
    bond: { need: 'role:guardian', stat: 'atk', pct: 18, text: 'Attack +18% per adjacent Guardian.' },
    art: {
      base: '#7fce5a', accent: '#4d9433', belly: '#eaf9cf', element: 'bloom',
      body: 'slim', ears: 'cat', eyes: 'sharp', muzzle: 'nose', tail: 'leaf',
      earInner: '#d8f2b0', eyeColor: '#3f7a2a', seed: 1, scale: 0.94,
    },
  });

  def({
    id: 'bramble', name: 'Bramble', element: 'bloom', role: 'guardian', grade: 'B',
    title: 'Thornshell',
    blurb: 'Retreats into a shell of living bramble. Hitting it is usually the worse idea.',
    passive: { name: 'Thorns', text: 'Returns 30% of melee damage taken to the attacker.' },
    ult: {
      name: 'Bulwark', cost: 100,
      text: 'Shields itself and both neighbours for 140% of its defence for 8 seconds.',
      target: 'selfAndAdjacent', effect: [{ kind: 'shield', defMult: 1.4, duration: 8 }],
    },
    bond: { need: 'element:bloom', stat: 'def', pct: 20, text: 'Defence +20% per adjacent Bloom ally.' },
    art: {
      base: '#6fae4a', accent: '#4a7c30', belly: '#dff0c0', element: 'bloom',
      body: 'chubby', ears: 'round', eyes: 'wide', muzzle: 'snout', tail: 'none',
      extras: ['shell'], extraColor: '#7a5c38', eyeColor: '#2f6a22',
      seed: 2, scale: 1.02, headShape: 'wide',
    },
  });

  def({
    id: 'thistle', name: 'Thistle', element: 'bloom', role: 'mender', grade: 'B',
    title: 'Sporekeeper',
    blurb: 'A quiet fawn trailing healing spores. It has never thrown a punch in its life.',
    passive: { name: 'Drifting Spores', text: 'Heals the most wounded ally for 6% of their max health every 3 seconds.' },
    ult: {
      name: 'Bloomfall', cost: 100,
      text: 'Heals every ally for 220% attack and clears burn, chill and slow.',
      target: 'allAllies', effect: [{ kind: 'heal', mult: 2.2 }, { kind: 'cleanse' }],
    },
    bond: { need: 'row:back', stat: 'heal', pct: 25, text: 'Healing +25% while in the back row.' },
    art: {
      base: '#cfe0a8', accent: '#8fae68', belly: '#f4fadf', element: 'bloom',
      stance: 'quad', ears: 'long', eyes: 'sleepy', muzzle: 'snout', tail: 'thin',
      extras: ['flowers'], extraColor: '#ff9ec4', pattern: 'spots', patternColor: '#7a9450',
      eyeColor: '#5a7a3a', seed: 3, scale: 1.0,
    },
  });

  // ============================================================ EMBER
  def({
    id: 'cinder', name: 'Cinder', element: 'ember', role: 'striker', grade: 'B',
    title: 'Kindlefox',
    blurb: 'Every swipe leaves an ember behind. Cinder does not put things out.',
    passive: { name: 'Kindle', text: 'Attacks apply Burn: 12% attack per second for 4 seconds, stacking to 3.' },
    ult: {
      name: 'Wildfire', cost: 100,
      text: 'Sweeps a column for 190% attack and refreshes Burn on everything it touches.',
      target: 'columnEnemies', effect: [{ kind: 'damage', mult: 1.9 }, { kind: 'status', status: 'burn', duration: 4 }],
    },
    bond: { need: 'element:ember', stat: 'atk', pct: 15, text: 'Attack +15% per adjacent Ember ally.' },
    art: {
      base: '#f08040', accent: '#c0521f', belly: '#ffe2c4', element: 'ember',
      body: 'slim', ears: 'cat', eyes: 'sharp', muzzle: 'snout', tail: 'flame',
      cheekFur: true, earInner: '#ffcfa8', eyeColor: '#a83a1a', seed: 4, scale: 0.96,
    },
  });

  def({
    id: 'pyra', name: 'Pyra', element: 'ember', role: 'marksman', grade: 'A',
    title: 'Firework Hoarder',
    blurb: 'Carries far more explosives than a creature that size reasonably should.',
    passive: { name: 'Scatterburst', text: 'Attacks also hit both neighbours of the target for 45% damage.' },
    ult: {
      name: 'Skyfall', cost: 100,
      text: 'Rains shells on the enemy back row for 200% attack each.',
      target: 'backEnemies', effect: [{ kind: 'damage', mult: 2.0 }],
    },
    bond: { need: 'row:back', stat: 'atk', pct: 20, text: 'Attack +20% while in the back row.' },
    art: {
      base: '#e8a24a', accent: '#b06a22', belly: '#fff0d0', element: 'ember',
      body: 'round', ears: 'round', eyes: 'wide', muzzle: 'nose', tail: 'fluffy',
      extras: ['goggles'], cheekFur: true, eyeColor: '#8a4a12', seed: 5, scale: 0.9,
    },
  });

  def({
    id: 'magma', name: 'Magma', element: 'ember', role: 'guardian', grade: 'A',
    title: 'Cracked Shell',
    blurb: 'Its plates never fully cooled. Standing close is a commitment.',
    passive: { name: 'Molten Hide', text: 'Melee attackers take 20% of their own damage back as Burn.' },
    ult: {
      name: 'Eruption', cost: 100,
      text: 'Taunts every enemy for 4 seconds and burns the front row for 150% attack.',
      target: 'frontEnemies', effect: [{ kind: 'taunt', duration: 4 }, { kind: 'damage', mult: 1.5 }],
    },
    bond: { need: 'row:front', stat: 'hp', pct: 20, text: 'Health +20% while in the front row.' },
    art: {
      base: '#c85f3a', accent: '#8a3a20', belly: '#f0b078', element: 'ember',
      body: 'chubby', ears: 'none', eyes: 'sharp', muzzle: 'snout', tail: 'none',
      extras: ['spikes', 'mane'], extraColor: '#ff8a3c', eyeColor: '#ffbb55',
      pattern: 'spots', patternColor: '#5c1f0f', seed: 6, scale: 1.06, headShape: 'wide',
    },
  });

  // ============================================================ TIDE
  def({
    id: 'nimbus', name: 'Nimbus', element: 'tide', role: 'mender', grade: 'A',
    title: 'Drifting Bell',
    blurb: 'Floats a hand above the ground and hums. Allies near it simply stop dying.',
    passive: { name: 'Tidal Veil', text: 'Every 4 seconds, shields the lowest-health ally for 60% attack.' },
    ult: {
      name: 'Tidewell', cost: 100,
      text: 'Heals all allies for 180% attack and shields them for 90% attack.',
      target: 'allAllies', effect: [{ kind: 'heal', mult: 1.8 }, { kind: 'shield', mult: 0.9, duration: 8 }],
    },
    bond: { need: 'role:marksman', stat: 'heal', pct: 20, text: 'Healing +20% per adjacent Marksman.' },
    art: {
      base: '#6fc8e8', accent: '#3f8fb8', belly: '#dff4ff', element: 'tide',
      body: 'round', ears: 'antenna', eyes: 'sleepy', muzzle: 'none', tail: 'none',
      floats: true, extras: ['gem'], extraColor: '#a8ecff', eyeColor: '#2a6a8a',
      seed: 7, scale: 0.92, blushColor: '#7fd8f0',
    },
  });

  def({
    id: 'coral', name: 'Coral', element: 'tide', role: 'marksman', grade: 'B',
    title: 'Reef Lance',
    blurb: 'Fires a jet of water hard enough to punch straight through armour.',
    passive: { name: 'Pierce', text: 'Attacks ignore 50% of the target\'s defence.' },
    ult: {
      name: 'Riptide', cost: 100,
      text: 'Drives a torrent through a whole column for 175% attack.',
      target: 'columnEnemies', effect: [{ kind: 'damage', mult: 1.75 }],
    },
    bond: { need: 'element:tide', stat: 'atk', pct: 15, text: 'Attack +15% per adjacent Tide ally.' },
    art: {
      base: '#4aa8d8', accent: '#2a6f96', belly: '#cfeeff', element: 'tide',
      body: 'slim', ears: 'fin', eyes: 'wide', muzzle: 'beak', beakColor: '#ffd06a',
      tail: 'fan', eyeColor: '#1f5a7a', seed: 8, scale: 0.94, headShape: 'tall',
    },
  });

  def({
    id: 'frost', name: 'Frost', element: 'tide', role: 'trickster', grade: 'A',
    title: 'Coldstep',
    blurb: 'Waddles. Do not let the waddle fool you.',
    passive: { name: 'Chill', text: 'Attacks slow the target\'s attack speed by 20% for 3 seconds.' },
    ult: {
      name: 'Deep Freeze', cost: 100,
      text: 'Freezes the enemy front row solid for 3 seconds.',
      target: 'frontEnemies', effect: [{ kind: 'status', status: 'freeze', duration: 3 }],
    },
    bond: { need: 'role:striker', stat: 'atk', pct: 15, text: 'Attack +15% per adjacent Striker.' },
    art: {
      base: '#2f4a6a', accent: '#1d3048', belly: '#f4fbff', element: 'tide',
      body: 'chubby', ears: 'tuft', eyes: 'wide', muzzle: 'beak', beakColor: '#ffb648',
      extras: ['scarf'], extraColor: '#7fd8f0', eyeColor: '#3a6a9a',
      seed: 9, scale: 0.95, blushColor: '#8fc8e8',
    },
  });

  // ============================================================ STONE
  def({
    id: 'boulder', name: 'Boulder', element: 'stone', role: 'guardian', grade: 'B',
    title: 'The Wall',
    blurb: 'Sleeps through most of the fight. Somehow this works.',
    passive: { name: 'Bedrock', text: 'Takes 25% less damage while standing in the front row.' },
    ult: {
      name: 'Quake', cost: 100,
      text: 'Slams the ground: 130% attack to all enemies and stuns the front row for 1.5 seconds.',
      target: 'allEnemies',
      effect: [{ kind: 'damage', mult: 1.3 }, { kind: 'status', status: 'stun', duration: 1.5, only: 'front' }],
    },
    bond: { need: 'row:front', stat: 'def', pct: 25, text: 'Defence +25% while in the front row.' },
    art: {
      base: '#a8845c', accent: '#7a5c3a', belly: '#e0c8a0', element: 'stone',
      body: 'chubby', ears: 'none', eyes: 'sleepy', muzzle: 'snout', tail: 'none',
      muzzleColor: '#f0dcc0', noseColor: '#ff9ea8', eyeColor: '#5c4028',
      seed: 10, scale: 1.08, headShape: 'wide',
    },
  });

  def({
    id: 'quill', name: 'Quill', element: 'stone', role: 'striker', grade: 'C',
    title: 'Bristleback',
    blurb: 'Attacks by simply walking into things very fast.',
    passive: { name: 'Retaliate', text: 'Counterattacks for 60% attack whenever it is hit in melee.' },
    ult: {
      name: 'Spinout', cost: 100,
      text: 'Rolls through the front row, hitting each for 165% attack.',
      target: 'frontEnemies', effect: [{ kind: 'damage', mult: 1.65 }],
    },
    bond: { need: 'role:guardian', stat: 'def', pct: 20, text: 'Defence +20% per adjacent Guardian.' },
    art: {
      base: '#8a6f4a', accent: '#5c4630', belly: '#ddc59c', element: 'stone',
      body: 'round', ears: 'round', eyes: 'sharp', muzzle: 'snout', tail: 'none',
      extras: ['spikes'], extraColor: '#d8c8a8', eyeColor: '#4a3018',
      seed: 11, scale: 0.95,
    },
  });

  def({
    id: 'geode', name: 'Geode', element: 'stone', role: 'trickster', grade: 'A',
    title: 'Hollow Heart',
    blurb: 'Its crystal core rings when struck, and the sound does something unpleasant.',
    passive: { name: 'Resonance', text: 'Attacks reduce the target\'s defence by 12% for 5 seconds, stacking to 3.' },
    ult: {
      name: 'Shatterpoint', cost: 100,
      text: 'Strips 40% defence from all enemies for 8 seconds.',
      target: 'allEnemies', effect: [{ kind: 'debuff', stat: 'def', pct: 40, duration: 8 }],
    },
    bond: { need: 'element:stone', stat: 'atk', pct: 15, text: 'Attack +15% per adjacent Stone ally.' },
    art: {
      base: '#9a8fa8', accent: '#6a5f7a', belly: '#ded6ea', element: 'stone',
      body: 'round', ears: 'horn', hornColor: '#c8a8ff', eyes: 'wide', muzzle: 'nose',
      tail: 'none', extras: ['gem'], extraColor: '#c8a8ff', eyeColor: '#5a4a7a',
      seed: 12, scale: 0.98,
    },
  });

  // ============================================================ SPARK
  def({
    id: 'volt', name: 'Volt', element: 'spark', role: 'marksman', grade: 'B',
    title: 'Static Pup',
    blurb: 'Barks. Something explodes. The two facts are related.',
    passive: { name: 'Arc', text: 'Attacks chain to one more enemy for 50% damage.' },
    ult: {
      name: 'Thunderline', cost: 100,
      text: 'Chains through every enemy, dealing 120% attack and losing 15% per jump.',
      target: 'allEnemies', effect: [{ kind: 'chain', mult: 1.2, falloff: 0.15 }],
    },
    bond: { need: 'element:spark', stat: 'atk', pct: 15, text: 'Attack +15% per adjacent Spark ally.' },
    art: {
      base: '#f0c84a', accent: '#b08a1a', belly: '#fff4cf', element: 'spark',
      stance: 'quad', ears: 'cat', eyes: 'sharp', muzzle: 'snout', tail: 'bolt',
      cheekFur: true, earInner: '#ffe8a8', eyeColor: '#8a6a10', seed: 13, scale: 1.0,
    },
  });

  def({
    id: 'zephyr', name: 'Zephyr', element: 'spark', role: 'trickster', grade: 'A',
    title: 'Nightsnap',
    blurb: 'Drains the charge right out of whatever it bites.',
    passive: { name: 'Siphon', text: 'Attacks steal 8 ultimate energy from the target.' },
    ult: {
      name: 'Blackout', cost: 100,
      text: 'Drains 30 energy from every enemy and stuns the back row for 2 seconds.',
      target: 'allEnemies',
      effect: [{ kind: 'drain', amount: 30 }, { kind: 'status', status: 'stun', duration: 2, only: 'back' }],
    },
    bond: { need: 'role:mender', stat: 'atk', pct: 18, text: 'Attack +18% per adjacent Mender.' },
    art: {
      base: '#8a7fd8', accent: '#5a4f9a', belly: '#ddd8f8', element: 'spark',
      body: 'slim', ears: 'long', eyes: 'sharp', muzzle: 'nose', tail: 'thin',
      floats: true, eyeColor: '#efc84a', seed: 14, scale: 0.9,
    },
  });

  def({
    id: 'lumen', name: 'Lumen', element: 'spark', role: 'mender', grade: 'S',
    title: 'Lanternwing',
    blurb: 'The last light in the meadow, and it refuses to go out.',
    passive: { name: 'Afterglow', text: 'Allies that fall are revived once at 30% health.' },
    ult: {
      name: 'Daybreak', cost: 100,
      text: 'Heals all allies for 150% attack and grants 25 ultimate energy to each.',
      target: 'allAllies', effect: [{ kind: 'heal', mult: 1.5 }, { kind: 'energy', amount: 25 }],
    },
    bond: { need: 'row:back', stat: 'heal', pct: 20, text: 'Healing +20% while in the back row.' },
    art: {
      base: '#ffe08a', accent: '#d8a82a', belly: '#fff8dc', element: 'spark',
      body: 'round', ears: 'antenna', eyes: 'wide', muzzle: 'none', tail: 'none',
      floats: true, extras: ['crest'], extraColor: '#fff0a8', eyeColor: '#a8781a',
      seed: 15, scale: 0.92, blushColor: '#ffb37a',
    },
  });

  // ---------------------------------------------------------------- enemies
  /* Enemy-only units. They reuse the same stat model but read as wild rather
     than recruited, so battles are not just mirror matches. */
  const enemies = [];
  const foe = (c) => { c.enemyOnly = true; enemies.push(c); list.push(c); return c; };

  foe({
    id: 'sludgeling', name: 'Sludgeling', element: 'tide', role: 'striker', grade: 'E',
    title: 'Bog Spawn',
    blurb: 'Barely holds its own shape. Comes in numbers.',
    statMult: 0.6,
    passive: { name: 'Split', text: 'Nothing special. There are simply a lot of them.' },
    ult: { name: 'Splatter', cost: 100, text: 'Bursts for 150% attack on the nearest enemy.',
      target: 'nearestEnemy', effect: [{ kind: 'damage', mult: 1.5 }] },
    bond: null,
    art: {
      base: '#5a9a8a', accent: '#3a6a5c', belly: '#a8d8c8', element: 'tide',
      body: 'chubby', ears: 'none', eyes: 'wide', muzzle: 'none', tail: 'none',
      eyeColor: '#2a4a3a', seed: 21, scale: 0.8, blush: false,
    },
  });

  foe({
    id: 'rockhound', name: 'Rockhound', element: 'stone', role: 'striker', grade: 'D',
    title: 'Scree Runner',
    blurb: 'Hunts in packs across the shale.',
    statMult: 0.9,
    passive: { name: 'Pack Hunter', text: 'Attack +10% for each other Rockhound still standing.' },
    ult: { name: 'Maul', cost: 100, text: 'Savages one enemy for 220% attack.',
      target: 'nearestEnemy', effect: [{ kind: 'damage', mult: 2.2 }] },
    bond: null,
    art: {
      base: '#7a6a5c', accent: '#4a3f36', belly: '#b8a894', element: 'stone',
      stance: 'quad', ears: 'cat', eyes: 'sharp', muzzle: 'snout', tail: 'thin',
      eyeColor: '#c85a2a', seed: 22, scale: 0.95, blush: false, pattern: 'stripes',
      patternColor: '#2f2620',
    },
  });

  foe({
    id: 'wisp', name: 'Wisp', element: 'spark', role: 'marksman', grade: 'D',
    title: 'Storm Mote',
    blurb: 'A knot of loose weather that never quite dispersed.',
    statMult: 0.85,
    passive: { name: 'Flicker', text: 'Dodges 15% of incoming attacks outright.' },
    ult: { name: 'Discharge', cost: 100, text: 'Zaps the back row for 160% attack.',
      target: 'backEnemies', effect: [{ kind: 'damage', mult: 1.6 }] },
    bond: null,
    art: {
      base: '#b8a8f0', accent: '#7a68b8', belly: '#e8e0ff', element: 'spark',
      body: 'round', ears: 'antenna', eyes: 'visor', muzzle: 'none', tail: 'none',
      floats: true, eyeColor: '#5a4a9a', seed: 23, scale: 0.82, blush: false,
    },
  });

  foe({
    id: 'thornmaw', name: 'Thornmaw', element: 'bloom', role: 'guardian', grade: 'S',
    title: 'Warden of the Hollow',
    blurb: 'It was a hedge once. Then something crawled inside and stayed.',
    boss: true, statMult: 2.6,
    passive: { name: 'Overgrowth', text: 'Regenerates 2% of max health every second.' },
    ult: {
      name: 'Bramble Cage', cost: 100,
      text: 'Roots the whole enemy team for 2 seconds and deals 140% attack.',
      target: 'allEnemies', effect: [{ kind: 'damage', mult: 1.4 }, { kind: 'status', status: 'stun', duration: 2 }],
    },
    bond: null,
    art: {
      base: '#4f7a3a', accent: '#2f4f22', belly: '#8fbf68', element: 'bloom',
      body: 'chubby', ears: 'horn', hornColor: '#c8b06a', eyes: 'sharp', muzzle: 'snout',
      tail: 'none', extras: ['spikes', 'mane'], extraColor: '#7fa850',
      eyeColor: '#ffcf4a', pattern: 'spots', patternColor: '#1f3315',
      seed: 31, scale: 1.5, headShape: 'wide', blush: false,
    },
  });

  foe({
    id: 'cinderhorn', name: 'Cinderhorn', element: 'ember', role: 'striker', grade: 'S',
    title: 'The Long Burn',
    blurb: 'Walked out of the caldera and never cooled down.',
    boss: true, statMult: 2.4,
    passive: { name: 'Rising Heat', text: 'Attack increases 6% every 5 seconds, without limit.' },
    ult: {
      name: 'Pyroclasm', cost: 100,
      text: 'Detonates for 200% attack on all enemies and sets them alight.',
      target: 'allEnemies', effect: [{ kind: 'damage', mult: 2.0 }, { kind: 'status', status: 'burn', duration: 6 }],
    },
    bond: null,
    art: {
      base: '#d84a2a', accent: '#8a2410', belly: '#ffa860', element: 'ember',
      body: 'chubby', ears: 'horn', hornColor: '#ffcf6a', eyes: 'sharp', muzzle: 'snout',
      tail: 'flame', extras: ['mane', 'spikes'], extraColor: '#ff9a2a',
      eyeColor: '#ffe08a', seed: 32, scale: 1.5, blush: false,
    },
  });

  foe({
    id: 'voidpaw', name: 'Voidpaw', element: 'spark', role: 'trickster', grade: 'S',
    title: 'What Came Through',
    blurb: 'It wears the shape of a critter the way a hand wears a glove.',
    boss: true, statMult: 3.0,
    passive: { name: 'Unmaking', text: 'Immune to stun and freeze. Heals for 30% of the damage it deals.' },
    ult: {
      name: 'Erasure', cost: 100,
      text: 'Deals 230% attack to all enemies and drains 40 energy from each.',
      target: 'allEnemies', effect: [{ kind: 'damage', mult: 2.3 }, { kind: 'drain', amount: 40 }],
    },
    bond: null,
    art: {
      base: '#5a4a86', accent: '#2f2450', belly: '#8f7ed0', element: 'spark',
      body: 'chubby', ears: 'long', eyes: 'visor', muzzle: 'none', tail: 'thin',
      extras: ['crest', 'spikes'], extraColor: '#c05fd8', eyeColor: '#ff4a8a',
      seed: 33, scale: 1.6, blush: false,
    },
  });

  // ---------------------------------------------------------------- indexing
  const byId = {};
  list.forEach((c) => {
    const b = ROLES[c.role].base;
    const m = c.statMult || 1;
    c.stats = {
      hp: Math.round(b.hp * m),
      atk: Math.round(b.atk * m),
      def: Math.round(b.def * m),
      interval: b.interval,
      range: b.range,
    };
    byId[c.id] = c;
  });

  const playable = list.filter((c) => !c.enemyOnly);

  const GRADE = {
    E: { color: '#8d97a8', mult: 1.00 },
    D: { color: '#6fc96f', mult: 1.08 },
    C: { color: '#5fa8e8', mult: 1.16 },
    B: { color: '#b07fe8', mult: 1.26 },
    A: { color: '#f0a53f', mult: 1.38 },
    S: { color: '#ff6f8f', mult: 1.52 },
  };

  /** Final stats for a critter at a given level, before formation bonds. */
  function statsFor(c, level) {
    const g = GRADE[c.grade].mult;
    const lv = 1 + 0.13 * ((level || 1) - 1);
    return {
      hp: Math.round(c.stats.hp * g * lv),
      atk: Math.round(c.stats.atk * g * lv),
      def: Math.round(c.stats.def * g * lv),
      interval: c.stats.interval,
      range: c.stats.range,
    };
  }

  NS.Roster = {
    ELEMENTS, ELEMENT_ORDER, ROLES, GRADE,
    list, playable, enemies, byId,
    get: (id) => byId[id],
    elementMult,
    statsFor,
    bosses: list.filter((c) => c.boss),
  };
})(window.COC);

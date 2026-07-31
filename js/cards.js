/* Clash of Critters — cards.js
 * The whole card roster. Stats are tuned against a princess tower of 1400 HP
 * dealing ~112 DPS, so "how many hits to take a tower" stays intuitive.
 *
 * Common fields
 *   id, name, cost, rarity, kind: 'troop' | 'spell' | 'building'
 *   art: spec consumed by Art.critter / Art.building
 *
 * Troop / building combat fields
 *   hp, dmg, hitSpeed (s), range (tiles), speed (tiles/s), radius (tiles)
 *   targets: 'ground' | 'air' | 'both' | 'buildings'
 *   air: true if the unit itself flies
 *   splash: splash radius in tiles (0 = single target)
 *   count / formation: how many units spawn and how they are arranged
 */
window.COC = window.COC || {};
(function (NS) {
  'use strict';

  const SPEED = { slow: 0.72, medium: 1.0, fast: 1.32, veryFast: 1.7 };
  NS.SPEED = SPEED;

  const list = [];
  function card(def) { list.push(def); return def; }

  // ------------------------------------------------------------- 1 elixir
  card({
    id: 'pipsqueak', name: 'Pip Squeak', cost: 1, rarity: 'common', kind: 'troop',
    blurb: 'A tiny troublemaker. Cheap, fast, and perfect for pulling a tank off course.',
    hp: 210, dmg: 62, hitSpeed: 1.0, range: 0.35, speed: SPEED.fast, radius: 0.32,
    targets: 'ground', count: 1, mass: 0.6,
    art: {
      main: '#f0c56a', head: '#f5d489', belly: '#fff0cf', accent: '#e0a94b',
      body: 'slim', ears: 'cat', eyes: 'big', tail: 'thin', weapon: 'dagger',
      scale: 0.78, seed: 1, cheekColor: '#ff9db4',
    },
  });

  // ------------------------------------------------------------- 2 elixir
  card({
    id: 'whiskerling', name: 'Whiskerlings', cost: 2, rarity: 'common', kind: 'troop',
    blurb: 'Three pointy-eared scamps with knives. Melts anything that fights one target at a time.',
    hp: 140, dmg: 92, hitSpeed: 1.0, range: 0.35, speed: SPEED.veryFast, radius: 0.28,
    targets: 'ground', count: 3, formation: 'wedge', mass: 0.5,
    art: {
      main: '#8fd06a', head: '#9ada74', belly: '#e8f8cf', accent: '#68a84a',
      body: 'slim', ears: 'cat', eyes: 'angry', tail: 'thin', weapon: 'dagger',
      gear: 'bandana', gearColor: '#e0567a', scale: 0.72, seed: 2, fangs: true,
    },
  });

  card({
    id: 'glimmerbat', name: 'Glimmer Bats', cost: 2, rarity: 'common', kind: 'troop',
    blurb: 'Four fluttery pests. They ignore walls, water and your opponent\'s plans.',
    hp: 95, dmg: 76, hitSpeed: 1.05, range: 0.35, speed: SPEED.veryFast, radius: 0.26,
    targets: 'both', air: true, count: 4, formation: 'box', mass: 0.35,
    art: {
      main: '#9a86d8', head: '#a893e2', belly: '#ded4f7', accent: '#7a68b8',
      body: 'orb', ears: 'cat', eyes: 'big', wings: 'bat', wingColor: '#7a68b8',
      tail: 'none', legs: 'none', weapon: 'none', scale: 0.6, seed: 3, headR: 0.26,
    },
  });

  card({
    id: 'zappernewt', name: 'Zapper Newt', cost: 2, rarity: 'common', kind: 'spell',
    blurb: 'A crackle of static. Small damage, but it resets attacks and stuns for half a second.',
    spell: {
      radius: 2.3, dmg: 105, towerMult: 0.35, targets: 'both',
      effect: 'stun', duration: 0.6, sfx: 'zap', visual: 'zap',
    },
    art: {
      main: '#7fe0ff', head: '#9bebff', belly: '#e6faff', accent: '#3fb0e0',
      body: 'slim', ears: 'fin', eyes: 'big', tail: 'thin', weapon: 'none',
      scale: 0.72, seed: 4,
    },
  });

  // ------------------------------------------------------------- 3 elixir
  card({
    id: 'thistleknight', name: 'Thistle Knight', cost: 3, rarity: 'common', kind: 'troop',
    blurb: 'Chunky, dependable, and armoured in bark. The answer to most single-target problems.',
    hp: 1520, dmg: 168, hitSpeed: 1.2, range: 0.4, speed: SPEED.medium, radius: 0.45,
    targets: 'ground', count: 1, mass: 1.6,
    art: {
      main: '#8b9bb8', head: '#c3a882', belly: '#dfe6f2', accent: '#6d7c96',
      body: 'bulky', ears: 'none', eyes: 'angry', muzzle: 'snout', tail: 'none',
      weapon: 'sword', gear: 'helmet', gearColor: '#b9c4d6', scale: 0.92, seed: 5,
      cheeks: false,
    },
  });

  card({
    id: 'sprigarcher', name: 'Sprig Archers', cost: 3, rarity: 'common', kind: 'troop',
    blurb: 'A pair of steady shots that hit air and ground. Keep them behind something tough.',
    hp: 260, dmg: 94, hitSpeed: 1.2, range: 5.5, speed: SPEED.medium, radius: 0.3,
    targets: 'both', count: 2, formation: 'line',
    projectile: { speed: 12, kind: 'arrow' }, mass: 0.6,
    art: {
      main: '#79c65b', head: '#8ad46c', belly: '#e2f6cf', accent: '#4f9a3c',
      body: 'slim', ears: 'floppy', eyes: 'big', tail: 'leafy', weapon: 'bow',
      gear: 'leaf', gearColor: '#5fb043', scale: 0.78, seed: 6,
    },
  });

  card({
    id: 'bombbeetle', name: 'Bomb Beetle', cost: 3, rarity: 'common', kind: 'troop',
    blurb: 'Lobs bombs that splatter. Deletes swarms, but cannot hit anything airborne.',
    hp: 290, dmg: 215, hitSpeed: 1.9, range: 4.6, speed: SPEED.medium, radius: 0.32,
    targets: 'ground', splash: 1.8, count: 1,
    projectile: { speed: 7, kind: 'bomb', arc: true }, mass: 0.6,
    art: {
      main: '#5f6b8c', head: '#6d7aa0', belly: '#c9d0e6', accent: '#3f4a68',
      body: 'round', ears: 'antenna', eyes: 'goggles', tail: 'none', weapon: 'bomb',
      scale: 0.78, seed: 7, pattern: 'spots', patternColor: '#1a1f33',
    },
  });

  card({
    id: 'barbedbristles', name: 'Barbed Bristles', cost: 3, rarity: 'common', kind: 'troop',
    blurb: 'Four spiky sprinters. Cheap chip damage that punishes a lonely tank.',
    hp: 205, dmg: 70, hitSpeed: 0.85, range: 0.35, speed: SPEED.veryFast, radius: 0.26,
    targets: 'ground', count: 4, formation: 'box', mass: 0.45,
    art: {
      main: '#d98a4a', head: '#e59a5c', belly: '#f7d9b8', accent: '#a8622f',
      body: 'round', ears: 'tuft', eyes: 'angry', tail: 'stinger', weapon: 'none',
      scale: 0.66, seed: 8, fangs: true, pattern: 'stripes', patternColor: '#5c3216',
    },
  });

  card({
    id: 'acorncannon', name: 'Acorn Cannon', cost: 3, rarity: 'common', kind: 'building',
    blurb: 'A stubby ground-only cannon. The classic way to yank a charging beast off your tower.',
    hp: 820, dmg: 185, hitSpeed: 0.9, range: 5.6, radius: 0.6,
    targets: 'ground', lifetime: 30,
    projectile: { speed: 11, kind: 'ball' },
    art: { build: 'cannon', main: '#b98c5a', accent: '#5c6b7a', scale: 1.0 },
  });

  card({
    id: 'quillstorm', name: 'Quill Storm', cost: 3, rarity: 'common', kind: 'spell',
    blurb: 'A wide volley of quills. Wipes swarms off the board from anywhere on the map.',
    spell: {
      radius: 4.0, dmg: 255, towerMult: 0.35, targets: 'both',
      effect: 'damage', sfx: 'arrowsVolley', visual: 'arrows', delay: 0.55,
    },
    art: {
      main: '#c8b16a', head: '#d6c07c', belly: '#f2e8c6', accent: '#9b8443',
      body: 'slim', ears: 'tuft', eyes: 'angry', weapon: 'bow', scale: 0.72, seed: 9,
    },
  });

  card({
    id: 'honeyheal', name: 'Honey Heal', cost: 3, rarity: 'rare', kind: 'spell',
    blurb: 'Sticky golden goo. Heals your critters over three seconds — great after a big spell.',
    spell: {
      radius: 3.2, heal: 380, duration: 3.0, targets: 'friendly',
      effect: 'heal', sfx: 'heal', visual: 'heal',
    },
    art: {
      main: '#ffd05e', head: '#ffdd82', belly: '#fff3cf', accent: '#e0a232',
      body: 'round', ears: 'antenna', eyes: 'sleepy', wings: 'insect', weapon: 'none',
      legs: 'none', scale: 0.7, seed: 10,
    },
  });

  card({
    id: 'burrowmole', name: 'Burrow Mole', cost: 3, rarity: 'legendary', kind: 'troop',
    blurb: 'Digs in anywhere on the arena — even right next to the enemy king. Slow to surface.',
    hp: 1060, dmg: 172, hitSpeed: 1.2, range: 0.4, speed: SPEED.fast, radius: 0.36,
    targets: 'ground', count: 1, deployAnywhere: true, deployTime: 1.6, mass: 1.0,
    art: {
      main: '#8c7a68', head: '#9c8a76', belly: '#e0d2c2', accent: '#6a5a4a',
      body: 'round', ears: 'none', eyes: 'sleepy', muzzle: 'snout', tail: 'thin',
      weapon: 'hammer', gear: 'pot', gearColor: '#9aa4b2', scale: 0.8, seed: 11,
    },
  });

  // ------------------------------------------------------------- 4 elixir
  card({
    id: 'rocktoad', name: 'Rock Toad', cost: 4, rarity: 'common', kind: 'troop',
    blurb: 'A boulder with a face. Soaks up an enormous amount of punishment for the cost.',
    hp: 2250, dmg: 268, hitSpeed: 1.5, range: 0.45, speed: SPEED.slow, radius: 0.55,
    targets: 'ground', count: 1, mass: 2.6,
    art: {
      main: '#7d9a6a', head: '#8aa876', belly: '#d8e6c2', accent: '#5c7550',
      body: 'bulky', ears: 'none', eyes: 'big', eyeX: 0.15, muzzle: 'snout',
      tail: 'none', weapon: 'none', scale: 0.95, seed: 12,
      pattern: 'spots', patternColor: '#2f3f26', legW: 0.13,
    },
  });

  card({
    id: 'emberfox', name: 'Ember Fox', cost: 4, rarity: 'rare', kind: 'troop',
    blurb: 'Spits little fireballs that splash. Shreds ground swarms from a safe distance.',
    hp: 720, dmg: 138, hitSpeed: 1.4, range: 5.0, speed: SPEED.medium, radius: 0.34,
    targets: 'ground', splash: 1.45, count: 1,
    projectile: { speed: 9, kind: 'fire' }, mass: 0.8,
    art: {
      main: '#f08a3c', head: '#f79c52', belly: '#ffe0bd', accent: '#c9611f',
      body: 'slim', ears: 'cat', eyes: 'angry', muzzle: 'snout', tail: 'fluffy',
      weapon: 'staff', orbColor: '#ffb347', scale: 0.85, seed: 13,
    },
  });

  card({
    id: 'vinelancer', name: 'Vine Lancer', cost: 4, rarity: 'rare', kind: 'troop',
    blurb: 'Long reach, high single-target damage, hits air. The all-purpose defensive pick.',
    hp: 680, dmg: 178, hitSpeed: 1.1, range: 6.5, speed: SPEED.medium, radius: 0.32,
    targets: 'both', count: 1,
    projectile: { speed: 14, kind: 'dart' }, mass: 0.8,
    art: {
      main: '#5fbf9a', head: '#70cfa9', belly: '#d6f5e8', accent: '#3d9473',
      body: 'tall', ears: 'floppy', eyes: 'big', tail: 'leafy', weapon: 'spear',
      gear: 'leaf', scale: 0.86, seed: 14,
    },
  });

  card({
    id: 'wolfpup', name: 'Wolfpup Trio', cost: 4, rarity: 'common', kind: 'troop',
    blurb: 'Three quick biters that surround whatever they reach. Fragile against splash.',
    hp: 520, dmg: 155, hitSpeed: 1.0, range: 0.38, speed: SPEED.fast, radius: 0.33,
    targets: 'ground', count: 3, formation: 'wedge', mass: 0.9,
    art: {
      main: '#8d93a8', head: '#9ba2b8', belly: '#e2e6f0', accent: '#666d85',
      body: 'slim', ears: 'cat', eyes: 'angry', muzzle: 'snout', tail: 'fluffy',
      weapon: 'none', scale: 0.8, seed: 15, fangs: true,
    },
  });

  card({
    id: 'dragonfly', name: "Lil' Dragonfly", cost: 4, rarity: 'epic', kind: 'troop',
    blurb: 'A flying splash attacker. Nothing on the ground can touch it except ranged units.',
    hp: 1180, dmg: 168, hitSpeed: 1.6, range: 3.2, speed: SPEED.fast, radius: 0.42,
    targets: 'both', air: true, splash: 1.5, count: 1,
    projectile: { speed: 8, kind: 'fire' }, mass: 1.2,
    art: {
      main: '#6fd3c8', head: '#82e0d5', belly: '#d8f8f4', accent: '#3f9e94',
      body: 'round', ears: 'fin', eyes: 'big', muzzle: 'snout', tail: 'thin',
      wings: 'insect', legs: 'none', weapon: 'none', scale: 0.9, seed: 16,
    },
  });

  card({
    id: 'sporesisters', name: 'Spore Sisters', cost: 4, rarity: 'rare', kind: 'troop',
    blurb: 'Two mushroom mages whose spores linger, dealing damage over time.',
    hp: 440, dmg: 118, hitSpeed: 1.0, range: 5.0, speed: SPEED.medium, radius: 0.3,
    targets: 'both', count: 2, formation: 'line',
    projectile: { speed: 8, kind: 'spore' }, poison: { dps: 55, duration: 2.5 }, mass: 0.6,
    art: {
      main: '#c98fd8', head: '#d6a2e2', belly: '#f4e2f8', accent: '#9a63aa',
      body: 'slim', ears: 'none', eyes: 'big', tail: 'none', weapon: 'staff',
      orbColor: '#e8a8ff', gear: 'pot', gearColor: '#e07ab0', scale: 0.78, seed: 17,
    },
  });

  card({
    id: 'tuskcharger', name: 'Tusk Charger', cost: 4, rarity: 'rare', kind: 'troop',
    blurb: 'Ignores your defenders and gallops straight for a building. Fast and relentless.',
    hp: 1780, dmg: 292, hitSpeed: 1.6, range: 0.5, speed: SPEED.veryFast, radius: 0.5,
    targets: 'buildings', count: 1, jumpsRiver: true, mass: 2.2,
    art: {
      main: '#c98f6a', head: '#d69e79', belly: '#f4dcc2', accent: '#96613f',
      body: 'bulky', ears: 'floppy', eyes: 'angry', muzzle: 'snout', tail: 'thin',
      weapon: 'none', gear: 'bandana', gearColor: '#4a7fd0', scale: 0.95, seed: 18,
      fangs: true, hornColor: '#f6ecd8',
    },
  });

  card({
    id: 'fireblossom', name: 'Fireblossom', cost: 4, rarity: 'rare', kind: 'spell',
    blurb: 'A blooming explosion that knocks survivors back. Your answer to clumped-up pushes.',
    spell: {
      radius: 2.7, dmg: 590, towerMult: 0.3, targets: 'both',
      effect: 'damage', knockback: 1.1, sfx: 'explode', visual: 'fire', delay: 0.5,
    },
    art: {
      main: '#ff7a4d', head: '#ff8f66', belly: '#ffd9c2', accent: '#d1452a',
      body: 'orb', ears: 'tuft', eyes: 'angry', legs: 'none', weapon: 'none',
      scale: 0.75, seed: 19,
    },
  });

  card({
    id: 'frostbloom', name: 'Frostbloom', cost: 4, rarity: 'epic', kind: 'spell',
    blurb: 'Freezes everything it touches for four seconds. Buys you time nothing else can.',
    spell: {
      radius: 3.1, dmg: 95, towerMult: 0.35, targets: 'both',
      effect: 'freeze', duration: 4.0, sfx: 'freeze', visual: 'ice', delay: 0.35,
    },
    art: {
      main: '#8fd8ff', head: '#a4e2ff', belly: '#e6f7ff', accent: '#5aa8d8',
      body: 'round', ears: 'horn', hornColor: '#dff4ff', eyes: 'big',
      weapon: 'staff', orbColor: '#bfeaff', scale: 0.78, seed: 20,
    },
  });

  // ------------------------------------------------------------- 5 elixir
  card({
    id: 'petalprincess', name: 'Petal Princess', cost: 5, rarity: 'epic', kind: 'troop',
    blurb: 'Immense range and splash. Left alone behind a tank she will end the match.',
    hp: 940, dmg: 268, hitSpeed: 1.5, range: 7.2, speed: SPEED.medium, radius: 0.34,
    targets: 'both', splash: 1.1, count: 1,
    projectile: { speed: 9, kind: 'petal', arc: true }, mass: 0.9,
    art: {
      main: '#ff9ec4', head: '#ffb0d0', belly: '#ffe4f0', accent: '#d9628f',
      body: 'tall', ears: 'none', eyes: 'big', tail: 'none', weapon: 'staff',
      orbColor: '#ffd6e8', gear: 'crown', gearColor: '#ffd45e', scale: 0.88, seed: 21,
    },
  });

  card({
    id: 'skytalon', name: 'Sky Talon', cost: 5, rarity: 'rare', kind: 'troop',
    blurb: 'A diving raptor. Enormous damage, but it can only strike targets on the ground.',
    hp: 1420, dmg: 268, hitSpeed: 1.3, range: 1.0, speed: SPEED.fast, radius: 0.42,
    targets: 'ground', air: true, count: 1, mass: 1.2,
    art: {
      main: '#e8dcc0', head: '#f2e8d2', belly: '#fffaee', accent: '#c9a24a',
      body: 'tall', ears: 'none', eyes: 'angry', muzzle: 'beak', beakColor: '#ffb648',
      wings: 'feather', wingColor: '#d8c9a4', legs: 'none', weapon: 'none',
      scale: 0.92, seed: 22, cheeks: false,
    },
  });

  card({
    id: 'bumbledrone', name: 'Bumble Drone', cost: 5, rarity: 'epic', kind: 'troop',
    blurb: 'A fat flying tank with a splash sting. Only air-capable defenders can stop it.',
    hp: 2450, dmg: 190, hitSpeed: 1.8, range: 2.6, speed: SPEED.slow, radius: 0.55,
    targets: 'both', air: true, splash: 1.25, count: 1,
    projectile: { speed: 7, kind: 'sting' }, mass: 2.0,
    art: {
      main: '#ffd05e', head: '#ffdd82', belly: '#3b3450', accent: '#3b3450',
      body: 'bulky', ears: 'antenna', eyes: 'goggles', tail: 'stinger',
      wings: 'insect', legs: 'none', weapon: 'none', scale: 1.0, seed: 23,
      pattern: 'stripes', patternColor: '#241a2e',
    },
  });

  card({
    id: 'nectarnest', name: 'Nectar Nest', cost: 5, rarity: 'rare', kind: 'building',
    blurb: 'Drips out a steady stream of bees. Slow, patient, and infuriating to face.',
    hp: 1150, radius: 0.62, lifetime: 42,
    spawner: { unit: 'bee', count: 3, every: 5.0, first: 2.0 },
    art: { build: 'nest', main: '#c98f4a', accent: '#ffcf5e', scale: 1.0 },
  });

  card({
    id: 'turtlebunker', name: 'Turtle Bunker', cost: 5, rarity: 'rare', kind: 'building',
    blurb: 'A shelled fortress that shoots air and ground. Nothing gets past it cheaply.',
    hp: 2300, dmg: 128, hitSpeed: 1.0, range: 6.0, radius: 0.68,
    targets: 'both', lifetime: 36,
    projectile: { speed: 12, kind: 'ball' },
    art: { build: 'bunker', main: '#6f9a7a', accent: '#3f6b52', scale: 1.05 },
  });

  // ------------------------------------------------------------- 6+ elixir
  card({
    id: 'mossygolem', name: 'Mossy Golem', cost: 6, rarity: 'epic', kind: 'troop',
    blurb: 'Marches only at buildings. When it dies it bursts, and two pebble golems crawl out.',
    hp: 4400, dmg: 370, hitSpeed: 2.2, range: 0.55, speed: SPEED.slow, radius: 0.72,
    targets: 'buildings', count: 1, mass: 4.0,
    death: { dmg: 320, radius: 2.6, spawn: { unit: 'pebble', count: 2 } },
    art: {
      main: '#6f8a5a', head: '#7d9a68', belly: '#c2d8a8', accent: '#4f6640',
      body: 'bulky', ears: 'none', eyes: 'single', muzzle: 'none', tail: 'none',
      weapon: 'none', gear: 'leaf', scale: 1.2, seed: 24,
      pattern: 'spots', patternColor: '#2c3d22', legW: 0.16, cheeks: false,
    },
  });

  card({
    id: 'thunderbloom', name: 'Thunderbloom', cost: 6, rarity: 'epic', kind: 'spell',
    blurb: 'Three bolts strike the three toughest targets in the area, stunning each.',
    spell: {
      radius: 3.5, dmg: 720, towerMult: 0.35, targets: 'both', bolts: 3,
      effect: 'lightning', duration: 0.6, sfx: 'zap', visual: 'lightning', delay: 0.3,
    },
    art: {
      main: '#b9a8ff', head: '#c8b9ff', belly: '#eae4ff', accent: '#7f6ad8',
      body: 'orb', ears: 'horn', hornColor: '#ffe08a', eyes: 'angry',
      legs: 'none', weapon: 'staff', orbColor: '#ffe08a', scale: 0.8, seed: 25,
    },
  });

  card({
    id: 'grumblebear', name: 'Grumble Bear', cost: 7, rarity: 'legendary', kind: 'troop',
    blurb: 'The biggest critter in the meadow. Attacks anything, survives almost everything.',
    hp: 5400, dmg: 355, hitSpeed: 1.5, range: 0.6, speed: SPEED.slow, radius: 0.78,
    targets: 'ground', count: 1, mass: 4.5, splash: 0.9,
    art: {
      main: '#8a6a52', head: '#9a7a60', belly: '#d8c2a8', accent: '#5f4636',
      body: 'bulky', ears: 'floppy', eyes: 'angry', muzzle: 'snout', tail: 'none',
      weapon: 'club', weaponColor: '#a8734a', scale: 1.25, seed: 26,
      fangs: true, legW: 0.16,
    },
  });

  // ------------------------------------------------------------- spawn-only
  // These never appear in a deck; they are produced by other cards.
  const spawnOnly = {
    bee: {
      id: 'bee', name: 'Bee', cost: 0, kind: 'troop', hidden: true,
      hp: 110, dmg: 68, hitSpeed: 1.0, range: 0.35, speed: SPEED.veryFast, radius: 0.24,
      targets: 'both', air: true, count: 1, mass: 0.3,
      art: {
        main: '#ffd05e', head: '#ffdd82', belly: '#3b3450', accent: '#3b3450',
        body: 'orb', ears: 'antenna', eyes: 'big', wings: 'insect', legs: 'none',
        weapon: 'none', scale: 0.55, seed: 27, pattern: 'stripes', patternColor: '#241a2e',
        headR: 0.26,
      },
    },
    pebble: {
      id: 'pebble', name: 'Pebble Golem', cost: 0, kind: 'troop', hidden: true,
      hp: 1150, dmg: 140, hitSpeed: 1.8, range: 0.45, speed: SPEED.slow, radius: 0.44,
      targets: 'buildings', count: 1, mass: 1.8,
      death: { dmg: 130, radius: 1.9 },
      art: {
        main: '#6f8a5a', head: '#7d9a68', belly: '#c2d8a8', accent: '#4f6640',
        body: 'bulky', ears: 'none', eyes: 'single', tail: 'none', weapon: 'none',
        scale: 0.78, seed: 28, pattern: 'spots', patternColor: '#2c3d22', cheeks: false,
      },
    },
  };

  // ------------------------------------------------------------- indexing
  const byId = {};
  list.forEach((c) => {
    c.kind = c.kind || 'troop';
    c.count = c.count || 1;
    c.radius = c.radius || 0.35;
    c.deployTime = c.deployTime || 1.0;
    c.mass = c.mass || 1.0;
    c.splash = c.splash || 0;
    byId[c.id] = c;
  });
  Object.keys(spawnOnly).forEach((k) => {
    const c = spawnOnly[k];
    c.count = c.count || 1;
    c.deployTime = c.deployTime || 0;
    c.splash = c.splash || 0;
    byId[k] = c;
  });

  const RARITY_COLOR = {
    common: '#9fb3c8',
    rare: '#63b8ff',
    epic: '#c07aff',
    legendary: '#ffcf5e',
  };

  // A sensible starting deck: a win condition, a tank, air defence, splash and two spells.
  const STARTER_DECK = [
    'thistleknight', 'sprigarcher', 'tuskcharger', 'acorncannon',
    'bombbeetle', 'glimmerbat', 'fireblossom', 'zappernewt',
  ];

  // Decks the AI can be dealt, each with a coherent plan.
  const AI_DECKS = [
    {
      name: 'Boar Rush',
      cards: ['tuskcharger', 'thistleknight', 'sprigarcher', 'acorncannon',
        'bombbeetle', 'glimmerbat', 'fireblossom', 'zappernewt'],
    },
    {
      name: 'Golem Beatdown',
      cards: ['mossygolem', 'bumbledrone', 'petalprincess', 'vinelancer',
        'emberfox', 'barbedbristles', 'quillstorm', 'zappernewt'],
    },
    {
      name: 'Swarm Control',
      cards: ['whiskerling', 'barbedbristles', 'glimmerbat', 'wolfpup',
        'nectarnest', 'emberfox', 'quillstorm', 'frostbloom'],
    },
    {
      name: 'Air Force',
      cards: ['bumbledrone', 'dragonfly', 'skytalon', 'glimmerbat',
        'vinelancer', 'turtlebunker', 'fireblossom', 'honeyheal'],
    },
    {
      name: 'Bridge Bullies',
      cards: ['rocktoad', 'wolfpup', 'sporesisters', 'burrowmole',
        'petalprincess', 'acorncannon', 'quillstorm', 'zappernewt'],
    },
    {
      name: 'Heavy Meadow',
      cards: ['grumblebear', 'dragonfly', 'petalprincess', 'vinelancer',
        'thistleknight', 'turtlebunker', 'fireblossom', 'frostbloom'],
    },
  ];

  NS.Cards = {
    list,
    byId,
    playable: list,
    spawnOnly,
    RARITY_COLOR,
    STARTER_DECK,
    AI_DECKS,
    get(id) { return byId[id]; },
    /** Rough "how threatening is this" score, used by the AI and the deck stats. */
    threat(c) {
      if (c.kind === 'spell') return c.spell.dmg ? c.spell.dmg / 100 : 3;
      const dps = c.dmg ? c.dmg / c.hitSpeed : 0;
      return (c.hp * c.count) / 700 + (dps * c.count) / 90;
    },
  };
})(window.COC);

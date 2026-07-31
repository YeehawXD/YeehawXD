/* Fantasy Kritter — roster.js
 * Regioner, roller og karakterdata, direkte fra design-biblen.
 *
 *  §3.2  De fem regioner er samtidig spillets typesystem (§1.4: et rent
 *        typesystem skal være det, spilleren navigerer efter).
 *  §4    De syv kritter herunder er "første bølge" og sætter skabelonen:
 *        region, rolle, personlighed, visuel beskrivelse, evner, baggrund.
 *  §5.3  Regionerne giver holdbonusser, når kritter fra samme region kæmper
 *        sammen — det er det, `baand` udtrykker.
 *  §9.1  Fjender er aldrig omfarvede spillerfigurer. De har egne designs.
 */
window.COC = window.COC || {};
(function (NS) {
  'use strict';

  // ---------------------------------------------------------------- regioner
  /* Typecirklen: Sump → Skov → Sten → Ild → Frost → Sump.
   * Hver slår den næste. Fordel giver 1,5× skade OG 50% hurtigere ultimate,
   * så typematch er et tempovalg, ikke bare et skadestal. */
  const ELEMENTS = {
    skov: {
      id: 'skov', name: 'Mumleskoven', short: 'Skov', beats: 'sten',
      color: '#5f9f42', glow: '#a8e06a', icon: 'leaf',
      blurb: 'Tåget, fosforescerende skov hvor lyset kommer fra svampe.',
    },
    sten: {
      id: 'sten', name: 'Klipperiget Knirk', short: 'Sten', beats: 'ild',
      color: '#b07a45', glow: '#e8c48a', icon: 'rock',
      blurb: 'Bjerge af levende sten, der knirker og bevæger sig langsomt.',
    },
    ild: {
      id: 'ild', name: 'Emberhulen', short: 'Ild', beats: 'frost',
      color: '#e05e2a', glow: '#ffa860', icon: 'flame',
      blurb: 'Vulkansk underjordisk rige med glødende revner i klippen.',
    },
    frost: {
      id: 'frost', name: 'Frost-Fjeldet', short: 'Frost', beats: 'sump',
      color: '#4aa8dc', glow: '#a8e4ff', icon: 'crystal',
      blurb: 'Koldt højland, hvor iskrystaller klirrer som klokker i vinden.',
    },
    sump: {
      id: 'sump', name: 'Det Syngende Træsk', short: 'Sump', beats: 'skov',
      color: '#7d9a3a', glow: '#c8e07a', icon: 'drop',
      blurb: 'Sump hvor plantelivet næsten synger, og tågen danser i rytme.',
    },
  };
  const ELEMENT_ORDER = ['skov', 'sten', 'ild', 'frost', 'sump'];

  function elementMult(a, d) {
    if (!a || !d || a === d) return 1;
    if (ELEMENTS[a].beats === d) return 1.5;
    if (ELEMENTS[d].beats === a) return 0.7;
    return 1;
  }

  // ---------------------------------------------------------------- roller
  /* §4: Tank (holder linjen), Skader (DPS), Støtte (heal/buff),
   * Kontrol (debuff/crowd control), Snigmorder (burst mod enkeltmål). */
  const ROLES = {
    tank: {
      id: 'tank', name: 'Tank', color: '#7f9fd8',
      blurb: 'Holder linjen. Står forrest og tager slagene, så bagerste række overlever.',
      base: { hp: 320, atk: 17, def: 17, interval: 1.5, range: 0 },
    },
    skader: {
      id: 'skader', name: 'Skader', color: '#d8a83f',
      blurb: 'Skade på afstand. Skrøbelig, men afgør kampen hvis den får lov at skyde.',
      base: { hp: 130, atk: 33, def: 4, interval: 1.25, range: 1 },
    },
    stotte: {
      id: 'stotte', name: 'Støtte', color: '#5fc98a',
      blurb: 'Helbreder og skjolder. Vinder lange kampe helt af sig selv.',
      base: { hp: 150, atk: 14, def: 6, interval: 1.55, range: 1 },
    },
    kontrol: {
      id: 'kontrol', name: 'Kontrol', color: '#b07fd8',
      blurb: 'Bedøver, sænker og stjæler. Vender en tabt kamp på ét træk.',
      base: { hp: 160, atk: 22, def: 7, interval: 1.2, range: 1 },
    },
    snigmorder: {
      id: 'snigmorder', name: 'Snigmorder', color: '#e0705f',
      blurb: 'Springer forbi fronten og rammer det svageste mål hårdt.',
      base: { hp: 165, atk: 38, def: 5, interval: 1.0, range: 0 },
    },
  };

  // ---------------------------------------------------------------- sjældenhed
  /* §1.4: stjerne-sjældenhed vist direkte på kortet, 1-5 stjerner. */
  const RARITY = {
    almindelig: { id: 'almindelig', name: 'Almindelig', stars: 2, color: '#8d97a8', mult: 1.00 },
    sjaelden: { id: 'sjaelden', name: 'Sjælden', stars: 3, color: '#5fa8e8', mult: 1.16 },
    episk: { id: 'episk', name: 'Episk', stars: 4, color: '#b07fe8', mult: 1.34 },
    legendarisk: { id: 'legendarisk', name: 'Legendarisk', stars: 5, color: '#ffb54d', mult: 1.55 },
  };

  // ---------------------------------------------------------------- roster
  const list = [];
  const def = (c) => { list.push(c); return c; };

  def({
    id: 'rodde', name: 'Rodde', title: 'Skovvogteren',
    element: 'skov', role: 'tank', rarity: 'almindelig',
    person: 'Genert, men urokkelig loyal. Taler ikke meget, men stiller sig altid mellem sine venner og fare uden at blive bedt om det.',
    blurb: 'Gravede en tunnel gennem femten meter jord for at redde de andre unger, da en brand truede skovens hjerte. Siden da har skoven betragtet Rodde som sin beskytter — uanset hvor lille han er.',
    passive: {
      name: 'Tornekrans',
      text: 'Modangreb: skader fjender, der angriber Rodde direkte, for 30% af den skade de gør.',
    },
    ult: {
      name: 'Rodfæste', cost: 100,
      text: 'Skaber et skjold om hele holdet, der absorberer skade svarende til 140% af Roddes forsvar.',
      target: 'allAllies', effect: [{ kind: 'shield', defMult: 1.4, duration: 8 }],
    },
    baand: { need: 'element:skov', stat: 'def', pct: 20, text: 'Forsvar +20% pr. tilstødende Skov-allieret.' },
  });

  def({
    id: 'glimt', name: 'Glimt', title: 'Krystalspejderen',
    element: 'frost', role: 'skader', rarity: 'sjaelden',
    person: 'Nysgerrig, hurtig i replikken, en anelse overmodig. Elsker at vise sig frem, men bliver flov, hvis det går galt.',
    blurb: 'Støbt da et lyn ramte en gletsjer under en nordlysstorm. Ingen andre kritter i Frost-Fjeldet bevæger sig så hurtigt — og Glimt taber sjældent et væddeløb.',
    passive: {
      name: 'Frostrids',
      text: 'Angriber 25% hurtigere, så længe Glimt ikke har taget skade for nylig.',
    },
    ult: {
      name: 'Prisme-salve', cost: 100,
      text: 'Rammer en hel kolonne med stigende skade — 190% af angreb på hvert mål.',
      target: 'columnEnemies', effect: [{ kind: 'damage', mult: 1.9 }],
    },
    baand: { need: 'row:back', stat: 'atk', pct: 22, text: 'Angreb +22% i bagerste række.' },
  });

  def({
    id: 'grumle', name: 'Grumle', title: 'Klippeknuseren',
    element: 'sten', role: 'tank', rarity: 'sjaelden',
    person: 'Buldrende og kort for hovedet, men med et hjerte af — bogstaveligt talt — guld dybt inde i brystet. Brokker sig konstant, men er den første til at hjælpe.',
    blurb: 'Skåret ud af Knirk-bjergets rodfæste under et jordskælv for hundrede år siden. Har patruljeret klipperne lige siden — af ren stædighed, siger han selv.',
    passive: {
      name: 'Malm-skjold',
      text: 'Helbreder let, mens der tages skade, så længe Grumle er over halv sundhed.',
    },
    ult: {
      name: 'Jordskælv', cost: 100,
      text: 'Slår i jorden: 130% skade på alle fjender og bedøver forreste række i 1,5 sekunder.',
      target: 'allEnemies',
      effect: [{ kind: 'damage', mult: 1.3 }, { kind: 'status', status: 'stun', duration: 1.5, only: 'front' }],
    },
    baand: { need: 'row:front', stat: 'def', pct: 25, text: 'Forsvar +25% i forreste række.' },
  });

  def({
    id: 'sjatte', name: 'Sjatte', title: 'Sumpsangeren',
    element: 'sump', role: 'stotte', rarity: 'almindelig',
    person: 'Blid, lidt fjollet, synger konstant — nogle gange midt i en sætning. Elsker at trøste andre kritter, selv når ingen har bedt om det.',
    blurb: 'Født af den samme dam, som Træskets ældste sang stammer fra. Indrømmer selv, at melodien mest bliver til, mens man synger den.',
    passive: {
      name: 'Vuggevise',
      text: 'Helbreder holdets mest sårede med 6% af dens maksimale liv hvert 3. sekund.',
    },
    ult: {
      name: 'Boblevæg', cost: 100,
      text: 'Helbreder hele holdet for 200% af angreb, giver et skjold og renser negative effekter.',
      target: 'allAllies',
      effect: [{ kind: 'heal', mult: 2.0 }, { kind: 'shield', mult: 0.8, duration: 8 }, { kind: 'cleanse' }],
    },
    baand: { need: 'row:back', stat: 'heal', pct: 25, text: 'Helbredelse +25% i bagerste række.' },
  });

  def({
    id: 'askeoje', name: 'Askeøje', title: 'Emberulven',
    element: 'ild', role: 'snigmorder', rarity: 'episk',
    person: 'Kold, effektiv, taler sjældent — men beskytter fanatisk de yngre kritter i sin flok. Respekteres mere, end den frygtes.',
    blurb: 'Overlevede et ras i Emberhulens dybeste tunneler, som ingen andre kom levende fra. Vandrer nu i udkanten af flokken — altid tæt nok til at gribe ind, aldrig tæt nok til at høre til igen.',
    passive: {
      name: 'Gnistspor',
      text: 'Angreb antænder målet: 12% af angreb pr. sekund i 4 sekunder, stabler op til 3 gange.',
    },
    ult: {
      name: 'Askespring', cost: 100,
      text: 'Springer bag fjendens linje og udfører et kritisk angreb på det svageste mål for 280% af angreb.',
      target: 'weakestEnemy', effect: [{ kind: 'damage', mult: 2.8 }, { kind: 'leap' }],
    },
    baand: { need: 'role:tank', stat: 'atk', pct: 18, text: 'Angreb +18% pr. tilstødende Tank.' },
  });

  def({
    id: 'puddel', name: 'Puddel', title: 'Den Genstridige Sky',
    element: 'skov', role: 'kontrol', rarity: 'sjaelden',
    person: 'Doven og drilsk. Elsker at genere større kritter for sjov og stikke af, før de kan svare igen.',
    blurb: 'Driver formålsløst rundt over Mumleskoven og har aldrig fortalt nogen, hvor den kom fra — mest fordi Puddel synes, det er sjovere at lade folk gætte.',
    passive: {
      name: 'Regnbyge',
      text: 'Angreb sænker målets angrebsstyrke med 12% i 5 sekunder, stabler op til 3 gange.',
    },
    ult: {
      name: 'Tordenfnis', cost: 100,
      text: 'Bedøver bagerste fjendtlige række i 2 sekunder og dræner 30 ultimate-energi fra alle fjender.',
      target: 'allEnemies',
      effect: [{ kind: 'drain', amount: 30 }, { kind: 'status', status: 'stun', duration: 2, only: 'back' }],
    },
    baand: { need: 'role:skader', stat: 'atk', pct: 15, text: 'Angreb +15% pr. tilstødende Skader.' },
  });

  def({
    id: 'knog', name: 'Knog', title: 'Den Lille Spøgelsesridder',
    element: 'frost', role: 'kontrol', rarity: 'episk',
    person: 'Formel og høflig efter gammeldags skik. Tager sin ridderpligt dybt seriøst — selvom han kun er på størrelse med en huskat.',
    blurb: 'Var engang en fjeldrytters yndlingslegetøj — en lille, modig ponyridder-ånd, som aldrig fik lov at blive glemt, fordi et barn engang elskede ham for højt til at give slip.',
    passive: {
      name: 'Kold Omfavnelse',
      text: 'Angreb sænker målets angrebshastighed med 20% i 3 sekunder.',
    },
    ult: {
      name: 'Riddered', cost: 100,
      text: 'Tiltrækker alle fjendtlige angreb mod sig selv i 4 sekunder og fryser forreste række.',
      target: 'frontEnemies',
      effect: [{ kind: 'taunt', duration: 4 }, { kind: 'status', status: 'freeze', duration: 2.5 }],
    },
    baand: { need: 'element:frost', stat: 'def', pct: 20, text: 'Forsvar +20% pr. tilstødende Frost-allieret.' },
  });

  // ---------------------------------------------------------------- fjender
  /* §9.1: Fjender må aldrig være omfarvede genbrug af spillerens kritter.
   * Hver har egen kropsbygning, eget formål og egen silhuet. */
  const enemies = [];
  const foe = (c) => { c.enemyOnly = true; enemies.push(c); list.push(c); return c; };

  foe({
    id: 'skovtyv', name: 'Skovtyv', title: 'Bladsnupperen',
    element: 'skov', role: 'snigmorder', rarity: 'almindelig', statMult: 0.85,
    person: 'Griber hvad den kan nå, og er væk igen, før nogen opdager det.',
    blurb: 'Lange, tyveagtige fingre og en sæk fuld af stjålne blade. Stjæler ressourcer fra holdet under kamp.',
    passive: { name: 'Lange Fingre', text: 'Stjæler ultimate-energi fra sit mål ved hvert angreb.' },
    ult: {
      name: 'Snup og Stik Af', cost: 100, text: 'Rammer det svageste mål hårdt og dræner energi.',
      target: 'weakestEnemy', effect: [{ kind: 'damage', mult: 1.9 }, { kind: 'drain', amount: 20 }],
    },
    baand: null,
  });

  foe({
    id: 'mosekone', name: 'Mosekone', title: 'Tågevæveren',
    element: 'sump', role: 'kontrol', rarity: 'almindelig', statMult: 0.9,
    person: 'Hvisker fra tågen og forvirrer alt, der kommer for tæt på.',
    blurb: 'En sammenfiltret skikkelse af siv og tåge, der væver forvirring ud af sumpluften.',
    passive: { name: 'Tågeslør', text: 'Undviger 15% af alle angreb.' },
    ult: {
      name: 'Sumphvisken', cost: 100, text: 'Sænker alle fjenders forsvar markant.',
      target: 'allEnemies', effect: [{ kind: 'debuff', stat: 'def', pct: 35, duration: 8 }],
    },
    baand: null,
  });

  foe({
    id: 'slaggehund', name: 'Slaggehund', title: 'Smeltevogteren',
    element: 'ild', role: 'skader', rarity: 'almindelig', statMult: 0.95,
    person: 'Jager i flok langs de varme revner og giver aldrig slip.',
    blurb: 'Bygget af størknet slagge fra smeltediglerne dybt i Knirk. Jager altid sammen med sine egne.',
    passive: { name: 'Flokjæger', text: 'Angreb +10% for hver anden Slaggehund, der stadig står.' },
    ult: {
      name: 'Glødeskud', cost: 100, text: 'Sprøjter smeltet slagge over hele forreste række.',
      target: 'frontEnemies', effect: [{ kind: 'damage', mult: 1.7 }, { kind: 'status', status: 'burn', duration: 4 }],
    },
    baand: null,
  });

  foe({
    id: 'gnavrod', name: 'Gnavrod', title: 'Den Ældgamle',
    element: 'skov', role: 'tank', rarity: 'legendarisk', statMult: 1.9, boss: true,
    person: 'Har stået i Mumleskovens dybeste hjørne længere end nogen kan huske, og bryder sig ikke om gæster.',
    blurb: 'Et kæmpe, forvokset træ med et ansigt skåret ind i barken, der skifter udtryk alt efter, hvor meget skade det har taget. Rødderne kan trække kritter ned under jorden.',
    passive: { name: 'Rodnet', text: 'Regenererer 2% af sit maksimale liv hvert sekund.' },
    ult: {
      name: 'Rodgreb', cost: 100,
      text: 'Rødderne bryder op gennem jorden og fastholder hele holdet i 2 sekunder.',
      target: 'allEnemies', effect: [{ kind: 'damage', mult: 1.4 }, { kind: 'status', status: 'stun', duration: 2 }],
    },
    baand: null,
  });

  // ---------------------------------------------------------------- indeks
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
    // combat.js taler engelsk internt; biblen taler dansk udadtil
    c.bond = c.baand;
    c.grade = c.rarity;
    byId[c.id] = c;
  });

  const playable = list.filter((c) => !c.enemyOnly);

  function statsFor(c, level) {
    const g = RARITY[c.rarity].mult;
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
    ELEMENTS, ELEMENT_ORDER, ROLES, RARITY,
    GRADE: RARITY,
    list, playable, enemies, byId,
    get: (id) => byId[id],
    elementMult, statsFor,
    bosses: list.filter((c) => c.boss),
  };
})(window.COC);

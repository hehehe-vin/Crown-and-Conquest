/* ══════════════════════════════════════════════════════════════
   data.js  ·  Crown & Conquest — DAA-IV-T241
   Territory data, edge definitions, algorithm metadata,
   and the core mutable game state object.
══════════════════════════════════════════════════════════════ */

// ── TERRITORY DATA ─────────────────────────────────────────────
// 15 nodes matching Python backend map_data.py
// Coordinates tuned for SVG viewBox 0 0 1000 800
// "fog" flag controls whether stats are visible to player
const T = [
  { id:0,  name:"Paris",      x:155, y:358, type:"capital", status:"conquered", owner:"player",  units:5000, gold:0,    cost:0,  neighbors:[1,2,12],      revealed:true  },
  { id:1,  name:"London",     x:125, y:225, type:"city",    status:"unvisited", owner:"neutral", units:3000, gold:400,  cost:4,  neighbors:[0,2],          revealed:false },
  { id:2,  name:"Brussels",   x:228, y:324, type:"fort",    status:"scouted",   owner:"neutral", units:2000, gold:350,  cost:3,  neighbors:[0,1,3,5],      revealed:true  },
  { id:3,  name:"Amsterdam",  x:258, y:272, type:"city",    status:"scouted",   owner:"neutral", units:2500, gold:480,  cost:4,  neighbors:[2,4,5],        revealed:true  },
  { id:4,  name:"Copenhagen", x:410, y:155, type:"city",    status:"unvisited", owner:"neutral", units:2000, gold:300,  cost:5,  neighbors:[3,5],          revealed:false },
  { id:5,  name:"Berlin",     x:460, y:284, type:"capital", status:"unvisited", owner:"enemy",   units:4500, gold:900,  cost:9,  neighbors:[2,3,4,6,13],   revealed:false },
  { id:6,  name:"Prague",     x:488, y:366, type:"city",    status:"unvisited", owner:"neutral", units:2000, gold:380,  cost:5,  neighbors:[5,7,8,13],     revealed:false },
  { id:7,  name:"Munich",     x:408, y:415, type:"fort",    status:"unvisited", owner:"neutral", units:1500, gold:420,  cost:4,  neighbors:[6,8,9],        revealed:false },
  { id:8,  name:"Vienna",     x:558, y:428, type:"capital", status:"unvisited", owner:"enemy",   units:4000, gold:1100, cost:10, neighbors:[6,7,13],       revealed:false },
  { id:9,  name:"Milan",      x:360, y:528, type:"city",    status:"unvisited", owner:"neutral", units:2200, gold:650,  cost:5,  neighbors:[7,10,12],      revealed:false },
  { id:10, name:"Rome",       x:428, y:655, type:"city",    status:"unvisited", owner:"neutral", units:3000, gold:700,  cost:6,  neighbors:[9,11],         revealed:false },
  { id:11, name:"Naples",     x:505, y:758, type:"fort",    status:"unvisited", owner:"neutral", units:1800, gold:500,  cost:4,  neighbors:[10],           revealed:false },
  { id:12, name:"Madrid",     x:105, y:688, type:"city",    status:"unvisited", owner:"neutral", units:4000, gold:600,  cost:6,  neighbors:[0,9],          revealed:false },
  { id:13, name:"Warsaw",     x:658, y:256, type:"capital", status:"unvisited", owner:"enemy",   units:3500, gold:850,  cost:9,  neighbors:[5,6,8,14],     revealed:false },
  { id:14, name:"Moscow",     x:905, y:185, type:"capital", status:"unvisited", owner:"enemy",   units:6000, gold:1500, cost:14, neighbors:[13],           revealed:false },
];

// ── EDGES ─────────────────────────────────────────────────────
// [nodeA, nodeB, weight] — used for SVG rendering and local Dijkstra
// Note: London↔Brussels is 2 here (frontend display); backend map_data.py uses 3
const EDGES = [
  [0,1,4],[0,2,3],[0,12,6],
  [1,2,2],
  [2,3,2],[2,5,5],
  [3,4,3],[3,5,4],
  [4,5,4],
  [5,6,3],[5,13,5],
  [6,7,3],[6,8,4],[6,13,4],
  [7,8,4],[7,9,4],
  [8,13,3],
  [9,10,3],[9,12,5],
  [10,11,3],
  [13,14,6],
];

// ── ALGORITHM METADATA ─────────────────────────────────────────
// Renamed to in-world command names; technical names shown as sub-labels
const ALGO_META = {
  BFS: {
    label:    'Scout the Region',
    sublabel: 'Breadth-First Search',
    icon:     '🌊',
    color:    'rgba(58,150,100,.18)',
    iconCol:  '#7ab870',
    badge:    'BFS',
    time:  'O(V + E)',
    space: 'O(V)',
    desc:  'Explores level by level. Reveals adjacent territories in scouting order. Guarantees minimum hop-count path — ideal for finding all reachable borders.',
  },
  DFS: {
    label:    'Deep Reconnaissance',
    sublabel: 'Depth-First Search',
    icon:     '🗡',
    color:    'rgba(100,60,160,.18)',
    iconCol:  '#a080d0',
    badge:    'DFS',
    time:  'O(V + E)',
    space: 'O(V)',
    desc:  'Dives deep along one path before backtracking. Explores the full depth of a route — useful for detecting chokepoints and deep enemy flanks.',
  },
  Dijkstra: {
    label:    'Plan Supply Routes',
    sublabel: "Dijkstra's Algorithm",
    icon:     '⚡',
    color:    'rgba(26,58,110,.28)',
    iconCol:  '#8ab4e0',
    badge:    'O((V+E)logV)',
    time:  'O((V+E) log V)',
    space: 'O(V)',
    desc:  'Finds globally optimal shortest paths using a min-heap. Highlights the cheapest invasion route to every territory. Requires non-negative edge weights.',
  },
  Greedy: {
    label:    'Imperial Acquisitions',
    sublabel: 'Greedy Heuristic',
    icon:     '⚜',
    color:    'rgba(150,80,20,.22)',
    iconCol:  '#e0a060',
    badge:    'Greedy',
    time:  'O(n log n)',
    space: 'O(n)',
    desc:  'Selects highest gold-per-cost territory each step. Fast but not globally optimal — a greedy general wins battles but can lose campaigns.',
  },
};

// ── LOOT TABLE ─────────────────────────────────────────────────
// Rolled on every successful conquest to add surprise and reward
const LOOT_TABLE = [
  { weight: 45, type: 'gold',    label: 'War Chest Seized',      min: 60,   max: 220  },
  { weight: 25, type: 'army',    label: 'Recruits Conscripted',   min: 800,  max: 2500 },
  { weight: 15, type: 'morale',  label: 'Inspiring Victory',      min: 3,    max: 8    },
  { weight: 10, type: 'arsenal', label: 'Ancient Arsenal Found',  army: 4500            },
  { weight:  5, type: 'legend',  label: 'A Marshal Finds Glory',  glory: 15            },
];

// ── TERRITORY ATMOSPHERE ──────────────────────────────────────
// Narrative prose for each territory — drawn from story chapters.
// Shown on conquest result screen before resource numbers appear.
const TERRITORY_ATMOSPHERE = {

  Paris: {
    seal: '⚜',
    title: 'THE EAGLE\'S NEST',
    conquest: 'Paris is already yours. It has always been yours. The Tuileries stands silent — a palace of stone and secrets. You can still feel the ghost of Josephine\'s lips on your cheek from this morning. She kissed you goodbye and then pulled back into a silence so profound it felt like a physical weight.',
    sensory: 'Cobblestone and candle smoke and the echo of a revolution that has not finished deciding what it wants.',
    defeat: null,
    logVictory: 'The campaign begins where all campaigns begin — with a man staring at a map until Europe stops feeling like a continent.',
    logDefeat: null,
  },

  London: {
    seal: '🏴',
    title: 'THE ISLAND FALLS',
    conquest: 'London resists with the quiet stubbornness of an island that has never been successfully conquered. Until now. The harbor falls silent as the tricolour rises above the Tower. You stand on a dock that has supplied half the world\'s defiance and think: this is the sound a sea power makes when it runs out of sea.',
    sensory: 'Salt air, rain on slate, and the smell of a harbor that has supplied half the world\'s defiance.',
    defeat: 'The Channel holds. London remains behind its moat of grey water, and the defeat tastes like salt.',
    logVictory: 'London falls. The Channel is no longer a wall — it is a French road.',
    logDefeat: 'The offensive against London is repulsed. The island endures.',
  },

  Brussels: {
    seal: '⚑',
    title: 'THE CROSSROADS',
    conquest: 'Brussels folds quickly — a crossroads city accustomed to changing hands. The garrison surrenders with practiced efficiency. The mayor offers wine. You accept it, because refusing a man\'s wine when you\'ve taken his city is a cruelty even you have limits for. Berthier is already marking supply routes before the cork hits the table.',
    sensory: 'Wet cobblestone, gun oil, and the tang of a city that has learned to survive by bending.',
    defeat: 'Brussels holds its crossroads. The retreat is orderly, but Ney will not meet your eyes.',
    logVictory: 'Brussels yields. The crossroads of Europe is now a French supply depot.',
    logDefeat: 'The assault on Brussels falters. A crossroads can be defended from every direction.',
  },

  Amsterdam: {
    seal: '🏛',
    title: 'THE COUNTING HOUSE',
    conquest: 'Amsterdam opens its ledgers before its gates. The merchants calculate the cost of resistance and find it exceeds the price of surrender. It is the most rational capitulation you have ever witnessed. The city smells like canal water and commerce, and you wonder if there is a difference.',
    sensory: 'Canal water, ink, and the particular silence of men counting what they have left.',
    defeat: 'Amsterdam\'s merchants have calculated differently than expected. The cost of conquest, they have decided, is one you cannot afford today.',
    logVictory: 'Amsterdam opens its ledgers — and its gates. Commerce bows to the Eagle.',
    logDefeat: 'The Dutch hold Amsterdam. Commerce has its own fortifications.',
  },

  Copenhagen: {
    seal: '⚓',
    title: 'THE NORTHERN GATE',
    conquest: 'Copenhagen yields with the dignity of a nation that knows it cannot win but refuses to be humiliated. The Danish king meets you at the harbor, his spine straight, his voice steady. He hands you the keys to a city that smells like the Baltic — vast, cold, and older than any empire you will build.',
    sensory: 'Wind off the Baltic, tar and timber, and a chill that reaches your bones before your boots touch the dock.',
    defeat: 'The Danes hold their harbor. The Baltic wind carries the sound of your retreat like a cold sermon.',
    logVictory: 'Copenhagen falls. The Baltic opens like a door that was never locked — only guarded by cold.',
    logDefeat: 'Copenhagen endures. The north is not yet ready to thaw.',
  },

  Berlin: {
    seal: '🦅',
    title: 'THE EAGLE DEVOURS THE EAGLE',
    conquest: 'Berlin crashes. The Prussian eagle falls from the Brandenburg Gate and shatters on the cobblestones. The sound echoes through streets that have never heard French boots. You walk through the gate yourself because you want to feel what Frederick the Great felt, and you find that it feels like cold stone and the particular silence of a dynasty\'s last breath.',
    sensory: 'Stone and iron and the acrid taste of a dynasty\'s last breath.',
    defeat: 'Berlin holds. The Prussian eagle still perches above the Brandenburg Gate, and below it, your army regroups in silence.',
    logVictory: 'Berlin falls. The Prussian eagle shatters on its own cobblestones.',
    logDefeat: 'The Prussians hold Berlin. Frederick\'s ghost still commands from the grave.',
  },

  Prague: {
    seal: '🏰',
    title: 'THE ANCIENT WITNESS',
    conquest: 'Prague is ancient stone and labyrinthine alleys. The city watches you pass with the patience of something that has outlived every conqueror who ever walked its bridges. The castle above the river has seen Bohemian kings, Habsburg emperors, and now a Corsican. It does not seem impressed.',
    sensory: 'Damp stone, old incense, and the knowledge that this city remembers things you have not yet done.',
    defeat: 'Prague\'s old walls hold, as they have held for centuries. The city has outlived better armies than yours.',
    logVictory: 'Prague falls — though the city regards the event as temporary.',
    logDefeat: 'Prague endures. The Bohemian fortress has seen conquerors before. It has outlived them all.',
  },

  Munich: {
    seal: '⚔',
    title: 'THE BAVARIAN GATE',
    conquest: 'Munich falls like a fortress should — stubbornly, with honor, and with terms negotiated before the last wall cracked. The Bavarian commander salutes before surrendering his sword. You return it, because breaking a man who fought well serves no purpose that outlasts the afternoon.',
    sensory: 'Pine smoke, cold beer, and the metallic ring of a portcullis finally lowering.',
    defeat: 'Munich holds its walls. The Bavarians fight with a stubbornness that reminds you, uncomfortably, of yourself.',
    logVictory: 'Munich yields — with honor intact and cellars, Ney reports, worth the march.',
    logDefeat: 'The Bavarian gate holds. Munich will not be taken cheaply.',
  },

  Vienna: {
    seal: '👑',
    title: 'THE HEART OF EMPIRE',
    conquest: 'Vienna is chandeliers and whispered treaties. The Hofburg Palace opens its doors as if you were expected — and perhaps you were. Talleyrand has been here before. He walks the corridors with the ease of a man visiting an old friend, and you wonder, not for the first time, exactly whose side the corridors are on.',
    sensory: 'Candlewax, old paper, and the perfume of a court that has been scheming longer than your nation has existed.',
    defeat: 'The Austrians hold Vienna. The chandeliers of the Hofburg remain unlit by French torches. Talleyrand will not enjoy reporting this.',
    logVictory: 'Vienna opens the Hofburg. The Habsburg heart beats in French time now.',
    logDefeat: 'Vienna endures. The Habsburgs have been losing battles and winning centuries for a thousand years.',
  },

  Milan: {
    seal: '🌹',
    title: 'WHERE I WAS YOUNG',
    conquest: 'Milan. You were young here once. The light on the cathedral is exactly as you remember — the only thing in Europe that has not changed since you started changing everything else. You stand in the piazza and for one unguarded moment you are not the Emperor. You are the young general who walked these streets before the crown, before the campaigns, before the maps ate the garden.',
    sensory: 'Warm stone and church bells and the memory of a man who had not yet become an emperor.',
    defeat: 'Milan refuses your return. The cathedral is the same, but the young general who once walked these streets — he is the part that has changed.',
    logVictory: 'Milan falls — or rather, Milan remembers. You were young here once.',
    logDefeat: 'Milan holds. Some memories do not want to be revisited.',
  },

  Rome: {
    seal: '🏛',
    title: 'THE ETERNAL RECKONING',
    conquest: 'Rome does not fall. Rome simply acknowledges a new Caesar. The Colosseum has seen this before — the marching, the eagles, the man at the head of the column who believes he is different from the last one. You walk the Forum where emperors were made and unmade, and the stone is warm under your hand, and you think: they built all of this and it was not enough.',
    sensory: 'Dust and marble and the weight of two thousand years of men who believed they were permanent.',
    defeat: 'Rome holds its ancient ground. The Eternal City has buried better ambitions than yours, and the Colosseum does not flinch.',
    logVictory: 'Rome acknowledges a new Caesar. The Forum has seen this before.',
    logDefeat: 'Rome endures. It has buried every army that ever tried to own it.',
  },

  Naples: {
    seal: '🐎',
    title: 'MURAT\'S KINGDOM',
    conquest: 'Naples surrenders to Murat\'s cavalry with almost theatrical promptness. He rides through the streets in white velvet and gold lace, and the Neapolitans applaud because they understand that a king who dresses like a peacock is less dangerous than one who dresses like a soldier. You watch from the carriage and wonder how many more kingdoms you will have to manufacture before you run out of friends to crown.',
    sensory: 'Sea salt, volcanic dust, and the sound of a city that is already learning its new king\'s name.',
    defeat: 'Naples holds. Murat\'s cavalry charge breaks against walls that have seen Bourbon and Aragonese. His feathers are muddy.',
    logVictory: 'Naples bows — not to France, but to Murat. He does not notice the difference. You do.',
    logDefeat: 'The assault on Naples is repulsed. Murat\'s white velvet is stained with something other than glory.',
  },

  Madrid: {
    seal: '🗡',
    title: 'THE MISTAKE THE MAP COULD NOT SHOW',
    conquest: 'Madrid does not surrender. Madrid endures. The city is proud and unyielding, and even in capitulation there is a defiance in the stone that no treaty will dissolve. The people watch your column pass with eyes that are already composing the resistance. You have won the city. You have not won Madrid.',
    sensory: 'Dry heat, iron, and the silence of a people who have decided to remember this.',
    defeat: 'Madrid will not yield. It was proud and unyielding and was always the mistake — the territory your map showed as a border and your instinct should have shown as a warning.',
    logVictory: 'Madrid falls — but the silence in the streets is not surrender. It is a promise.',
    logDefeat: 'Madrid holds. Spain does not bend. It was always the mistake the map could not show you.',
  },

  Warsaw: {
    seal: '🕯',
    title: 'THE PRAYER OF A HUNDRED YEARS',
    conquest: 'Warsaw opens its gates with a hope that is enormous and fragile. The people line the streets. They do not cheer — they pray. You are the answer to a question they have been asking for a hundred years, and the weight of that is not something any map prepared you for. A woman holds a child up so he can see you pass. The child waves a flag too big for his hands.',
    sensory: 'Bread and wood smoke and a cold that has been here longer than any army.',
    defeat: 'Warsaw\'s hope endures behind its walls. The people who prayed for liberation will pray again tomorrow.',
    logVictory: 'Warsaw opens its gates — with prayer, not surrender. The weight of hope is heavier than artillery.',
    logDefeat: 'Warsaw holds its hope behind its walls. A hundred years of prayer will not end today.',
  },

  Moscow: {
    seal: '🔥',
    title: 'THE CITY THAT BURNED ITSELF',
    conquest: 'Moscow is silence and smoke. The gates stand open. No delegation. No surrender. No one at all. The city that was supposed to be the crown of the campaign is a ghost dressed in ash.\n\nThe fires started before you arrived. They burned their own capital rather than let you have it. You stand in the middle of a street that no longer has walls on either side, and the silence is the kind that arrives after something irreversible. Ney is behind you. He has not spoken. That, more than the smoke, tells you everything.',
    sensory: 'Smoke. Nothing but smoke. The silence is the kind that arrives after something irreversible.',
    defeat: 'The Russians retreat but do not break. They draw you east, into cold and distance, and the defeat tastes like winter arriving early.',
    logVictory: 'Moscow is taken. The city burned itself. In the silence, you hear nothing — not even your own certainty.',
    logDefeat: 'The Russian army bends but does not break. Moscow remains — distant, cold, already on fire.',
  },
};

// ── MARSHAL CONQUEST REACTIONS ─────────────────────────────────
// One-line reactions from each marshal, varying by game chapter.
// Chapter is determined by territory count at time of conquest.
const MARSHAL_CONQUEST_VOICE = {
  ney: {
    1: '"The city is ours before their coffee went cold, Sire." He grins like a man who has never considered the possibility of dying.',
    2: '"Another flag for the collection." His voice carries across the camp, but there is a new edge — the sound of a man starting to believe he doesn\'t need permission.',
    3: '"I saw the gap. I took it." He says this as if it explains everything. Perhaps it does.',
    4: '"The men didn\'t fight for France today. They fought because stopping is harder than advancing." He does not look at you when he says this.',
    5: '"It\'s done." Two words. He used to need a hundred. Something has been spent that glory cannot replenish.',
  },
  berthier: {
    1: 'Berthier marks the new territory with the precision of a surgeon. He has seventeen copies of every map. He is not taking chances.',
    2: '"The supply lines are extended but viable, Sire. I have prepared contingencies for the contingencies." His pen never stops.',
    3: '"The logistics are straining, Sire. But the numbers hold." His voice is flat, drained of anything but data.',
    4: 'Berthier files the report. It is correct, as it always is. You almost say something. The words die behind your teeth.',
    5: 'Berthier\'s final marks on the map are precise. His hand is steady. After all these years, his hand is the steadiest thing in the Empire.',
  },
  murat: {
    1: '"A king should look like a king, Sire — even if he hasn\'t found his kingdom yet." He rides off, a theatrical blur of vanity and genuine bravery.',
    2: '"I am angling for both glory and a throne, Sire. Always." His chest swells beneath gold lace and crimson velvet.',
    3: '"This city will remember my cavalry. They always do." He speaks of "his" people now. The crown fits him too well.',
    4: '"Send word to Naples — their King rides victorious." He signs dispatches with a flourish that takes half the page.',
    5: 'Murat is quiet for once. The gold lace is dusty. Even peacocks grow tired of display.',
  },
  talleyrand: {
    1: 'Talleyrand watches from the shadows. He does not speak. His silence is a calculation.',
    2: '"A satisfactory arrangement," Talleyrand murmurs. He has already drafted three versions of the peace terms.',
    3: '"Peace is a fruit that rots if left on the branch too long," he observes — to the Austrian envoy, not to you.',
    4: '"The Empire stretches further than any treaty can guarantee, Sire." His tone suggests he has already imagined the contraction.',
    5: 'Talleyrand says nothing. He has served four regimes. The silence of the fifth is already forming behind his eyes.',
  },
  josephine: {
    1: 'A letter from Josephine arrives with the courier. She speaks of the gardens. You fold it and carry it next to the maps.',
    2: 'Josephine\'s letter is four paragraphs shorter than the last. The space between her words is growing.',
    3: 'She writes of roses — a shade between the red of a soldier\'s coat and the purple-grey of a sky before a storm. She does not ask when you are returning.',
    4: 'Her letter sits near the inkwell. You have reached for it four times. Each time, something intervened. There was always a next thing.',
    5: 'You think of her laugh — ordinary, specific, and loud enough to drown out the coming guns.',
  },
};

// ── CORE GAME STATE ─────────────────────────────────────────────
// Single source of truth for all mutable runtime values
let res = {
  army:   30000,   // reduced for scarcity — was 50000
  gold:   600,     // reduced for scarcity — was 1200
  morale: 85,
  turn:   1,
};

// Currently active algorithm key
let algo = 'Dijkstra';

// Currently selected territory id (null = none)
let selId = null;

// Algorithm animation state
let running   = false;
let abortFlag = false;
let animMs    = 750;

// Per-battle state (cleared each battle)
let battleState = {
  commitFraction: 1.0,   // how much army to commit (0.25 / 0.5 / 0.75 / 1.0)
  marshalAbility: null,  // key of chosen marshal ability, or null
};

// ── HELPERS ────────────────────────────────────────────────────
/** Get edge weight between two node IDs */
function edgeW(a, b) {
  const e = EDGES.find(e => (e[0]===a&&e[1]===b) || (e[0]===b&&e[1]===a));
  return e ? e[2] : 1;
}

/** Returns territory IDs adjacent to any player-owned territory, excluding owned */
function getReachable() {
  const reachable = [];
  T.forEach(t => {
    if (t.owner === 'player') {
      t.neighbors.forEach(nid => {
        if (T[nid].owner !== 'player' && !reachable.includes(nid)) {
          reachable.push(nid);
        }
      });
    }
  });
  return reachable;
}

/** Reveal stats for a territory (remove fog). Never downgrades conquered nodes. */
function revealTerritory(id) {
  T[id].revealed = true;
  if (T[id].status === 'unvisited' && T[id].owner !== 'player') {
    T[id].status = 'scouted';
  }
}

/** Roll on the loot table and return a loot result object */
function rollLoot() {
  const total = LOOT_TABLE.reduce((s, e) => s + e.weight, 0);
  let roll = Math.random() * total;
  for (const entry of LOOT_TABLE) {
    roll -= entry.weight;
    if (roll <= 0) {
      const result = { type: entry.type, label: entry.label };
      if (entry.type === 'gold')    result.amount = Math.floor(Math.random() * (entry.max - entry.min) + entry.min);
      if (entry.type === 'army')    result.amount = Math.floor(Math.random() * (entry.max - entry.min) + entry.min);
      if (entry.type === 'morale')  result.amount = Math.floor(Math.random() * (entry.max - entry.min) + entry.min);
      if (entry.type === 'arsenal') result.amount = entry.army;
      if (entry.type === 'legend')  result.glory  = entry.glory;
      return result;
    }
  }
  return LOOT_TABLE[0]; // fallback
}

/** Apply a loot result to game state; returns display string */
function applyLoot(loot) {
  switch (loot.type) {
    case 'gold':
      res.gold += loot.amount;
      return `${loot.label}: +${loot.amount} Gold`;
    case 'army':
      res.army += loot.amount;
      return `${loot.label}: +${loot.amount.toLocaleString()} Troops`;
    case 'morale':
      res.morale = Math.min(100, res.morale + loot.amount);
      return `${loot.label}: +${loot.amount}% Morale`;
    case 'arsenal':
      res.army += loot.amount;
      return `⚔ ${loot.label}: +${loot.amount.toLocaleString()} Troops!`;
    case 'legend':
      // boost the marshal with the highest loyalty that isn't already Legend
      Story.boostRandomMarshal(loot.glory);
      return `★ ${loot.label}!`;
    default:
      return loot.label;
  }
}

/** Reset T array and res to initial values */
function resetGameData() {
  const initialUnits  = [5000,3000,2000,2500,2000,4500,2000,1500,4000,2200,3000,1800,4000,3500,6000];
  const initialOwners = ['player','neutral','neutral','neutral','neutral','enemy','neutral','neutral','enemy','neutral','neutral','neutral','neutral','enemy','enemy'];
  const initialStat   = ['conquered','scouted','scouted','unvisited','unvisited','unvisited','unvisited','unvisited','unvisited','unvisited','unvisited','unvisited','unvisited','unvisited','unvisited'];
  const initialReveal = [true,false,true,true,false,false,false,false,false,false,false,false,false,false,false];

  T.forEach((t, i) => {
    t.status   = initialStat[i];
    t.owner    = initialOwners[i];
    t.units    = initialUnits[i];
    t.revealed = initialReveal[i];
  });

  res.army   = 30000;
  res.gold   = 600;
  res.morale = 85;
  res.turn   = 1;

  selId      = null;
  running    = false;
  abortFlag  = true;
  battleState = { commitFraction: 1.0, marshalAbility: null };
}

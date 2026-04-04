/* ══════════════════════════════════════════════════════════════
   story.js  ·  Crown & Conquest — DAA-IV-T241
   Story event system, marshal loyalty/glory engine,
   chapter tracker, chapter transitions, Josephine letter arc,
   and win-screen personalisation.
   Exposed as the global `Story` object.
══════════════════════════════════════════════════════════════ */

const Story = (() => {

  // ── STATE ───────────────────────────────────────────────────
  let fired     = new Set();
  let queue     = [];
  let isOpen    = false;
  let storyPath = [];
  let currentChapter = 1;

  // ── MARSHALS ────────────────────────────────────────────────
  const MARSHALS = {
    murat:      { name:'Murat',     title:'King of Naples',       loyalty:80, alive:true, glory:0, emoji:'🐎' },
    ney:        { name:'Ney',       title:'Prince of the Moskva', loyalty:90, alive:true, glory:0, emoji:'🗡' },
    berthier:   { name:'Berthier',  title:'Chief of Staff',       loyalty:75, alive:true, glory:0, emoji:'📜' },
    talleyrand: { name:'Talleyrand',title:'Foreign Minister',     loyalty:55, alive:true, glory:0, emoji:'🕯' },
    josephine:  { name:'Josephine', title:'Empress',              loyalty:70, alive:true, glory:0, emoji:'💌' },
  };

  function mloy(id, delta) {
    if (!MARSHALS[id]) return;
    MARSHALS[id].loyalty = Math.max(0, Math.min(100, MARSHALS[id].loyalty + delta));
  }

  function mglory(id, delta) {
    if (!MARSHALS[id]) return;
    MARSHALS[id].glory = Math.max(0, MARSHALS[id].glory + delta);
  }

  function marshalStatus(m) {
    if (!m.alive)        return { cls:'dead',     label:'Fallen'   };
    if (m.glory  >= 40)  return { cls:'legend',   label:'Legend'   };
    if (m.loyalty >= 75) return { cls:'loyal',    label:'Loyal'    };
    if (m.loyalty >= 45) return { cls:'wavering', label:'Wavering' };
    return                      { cls:'hostile',  label:'Hostile'  };
  }

  const playerCount = () => T.filter(t => t.owner === 'player').length;

  function getChapter() {
    const owned = playerCount();
    if (owned >= 13) return 5;
    if (owned >= 10) return 4;
    if (owned >= 7)  return 3;
    if (owned >= 4)  return 2;
    return 1;
  }

  // ── CHAPTER DEFINITIONS ──────────────────────────────────────
  const CHAPTERS = {
    1: { numeral: 'I',   name: 'THE EAGLE AWAKENS',     epigraph: '"I am very good at problems. I have been telling myself this since Corsica and it has been true every time."' },
    2: { numeral: 'II',  name: 'THE ADVANCE BEGINS',    epigraph: '"It is no longer a campaign, Berthier. It is an equilibrium."' },
    3: { numeral: 'III', name: 'THE TIDE OF CONQUEST',   epigraph: '"Practicality is the language of people who have stopped waiting."' },
    4: { numeral: 'IV',  name: 'THE IMPERIAL ZENITH',    epigraph: '"I was beginning to notice the things I almost never did."' },
    5: { numeral: 'V',   name: 'THE FINAL RECKONING',    epigraph: '"The map is just paper. The laugh is the only thing that was ever real."' },
  };

  // ── EVENTS ──────────────────────────────────────────────────
  const EVENTS = [

    // ══ CHAPTER I — THE EAGLE AWAKENS ══

    {
      id: 'eagle_awakens',
      seal: '⚜', source: 'Imperial Dispatch — Paris, 1805',
      title: 'The Eagle Awakens',
      body: `The year is 1805. I have looked at this map so many times that Europe has stopped feeling like a continent and started feeling like an argument I intend to win.\n\nThe ink lines bleed into the parchment. Mountain ranges reduced to scratches of charcoal, rivers turned into veins of fading blue. Behind me, the Tuileries remains silent. I can still feel the ghost of Josephine's lips on my cheek.\n\nSteam rises from the flanks of horses in the pre-dawn chill. The Grande Armée — eighty thousand men — awaits a command that will change the shape of the world.\n\n<em>What is your opening strategy?</em>`,
      choices: [
        { label:'⚡ Strike Swift — Prioritise Speed', sub:'Scout with BFS — flood the frontier',
          effect:() => { res.army += 5000; mloy('ney',+10); mglory('ney',10); storyPath.push('aggressive'); },
          outcome:'"Give me the vanguard," Ney says, stepping closer. The scent of leather and unwashed skin follows him. "Let me break the crust of the Austrians before they\'ve had their coffee." The scouts ride hard. <em>(+5,000 Army · Ney +10 Loyalty)</em>' },
        { label:'🗺 Plan Deeply — Study the Routes', sub:'Use Dijkstra — find the optimal path first',
          effect:() => { res.gold += 400; mloy('berthier',+10); mglory('berthier',10); storyPath.push('strategic'); },
          outcome:'"The third wagon of maps, Sire." Berthier holds out a leather-bound case as if it contains the Host. Seventeen copies. He expects the world to be uncooperative. The shortest paths are marked in red ink. Not one march wasted. <em>(+400 Gold · Berthier +10 Loyalty)</em>' },
        { label:'🕯 Consult Talleyrand — Seek Allies', sub:'Diplomacy before blades',
          effect:() => { res.morale = Math.min(100, res.morale+15); mloy('talleyrand',+15); storyPath.push('diplomatic'); },
          outcome:'Talleyrand watches from the shadows of a black carriage, a pale, cold presence. He doesn\'t speak. He doesn\'t have to. His silence is a calculation. Not every conquest requires a battle — some borders open with the right letter. <em>(+15 Morale · Talleyrand +15 Loyalty)</em>' },
      ],
      trigger:() => !fired.has('eagle_awakens') && res.turn === 1,
    },

    {
      id: 'first_blood',
      seal: '⚔', source: 'Field Dispatch — Campaign Diary',
      title: 'First Blood',
      body: `The first territory falls. The soldiers cheer.\n\nBut victory is not merely conquest — it is the management of what you have taken. The city needs a garrison. The locals eye your soldiers with suspicion. Your generals argue about the next move.\n\nNey wants to press forward — his voice a battle-cry disguised as a greeting. Berthier counsels consolidation, his ink-stained fingers twitching. Talleyrand is conspicuously silent.\n\n<em>What does the Emperor decide?</em>`,
      choices: [
        { label:'⚔ Press Forward Immediately', sub:'Strike while morale is high',
          effect:() => { res.army += 4000; res.morale = Math.min(100,res.morale+8); mloy('ney',+8); mglory('ney',8); storyPath.push('decisive'); },
          outcome:'The army moves before dawn. Ney rides at the head of the column, laughing. He believes in you the way other men believe in God — with a blind, frantic energy that masks a terror of being forgotten. <em>(+4,000 Army · +8 Morale · Ney +8 Glory)</em>' },
        { label:'🏰 Consolidate — Secure the Gains', sub:'A secure base beats a fragile advance',
          effect:() => { res.gold += 500; mloy('berthier',+10); storyPath.push('cautious'); },
          outcome:'Supply lines are built. Garrisons are left. Berthier lives in the details because the big picture — the sheer, terrifying scale of what you are doing — would crush a man of lesser precision. <em>(+500 Gold · Berthier +10 Loyalty)</em>' },
        { label:'📜 Offer Terms to the Next Target', sub:'Surrender demands before battle',
          effect:() => { res.morale = Math.min(100,res.morale+5); mloy('talleyrand',+10); storyPath.push('diplomatic'); },
          outcome:'A courier rides with your terms. To acknowledge Talleyrand is to acknowledge the possibility of an end. But sometimes mercy is the most powerful weapon. <em>(+5 Morale · Talleyrand +10 Loyalty)</em>' },
      ],
      trigger:() => !fired.has('first_blood') && res.turn >= 2 && playerCount() >= 2,
    },

    {
      id: 'murats_plumage',
      seal: '🐎', source: 'Camp Observation — Dawn Patrol',
      title: 'A Splash of Impossible Color',
      body: `Further down the line, Marshal Murat preens. He is a splash of impossible color against the grey morning — gold lace, crimson velvet, and a peacock feather in his hat that catches the first weak rays of light. He sits atop a white stallion that looks like it was carved from a cloud.\n\n"A bit subtle for a campaign, isn't it, Joachim?" you call out.\n\n"A King should look like a King, Sire. Even if he hasn't found his kingdom yet."\n\n<em>Everyone here wants something they can't name.</em>`,
      choices: [
        { label:'👑 Promise Him a Kingdom', sub:'Bind his ambition to your service',
          effect:() => { mloy('murat',+15); mglory('murat',10); storyPath.push('murat_promised'); },
          outcome:'"Win the battle first. The crown comes later." Murat rides off, a theatrical blur of vanity and genuine, reckless bravery. He wants a throne. You have just shown him where to find it. <em>(Murat +15 Loyalty · +10 Glory)</em>' },
        { label:'⚔ Remind Him of His Rank', sub:'Generals serve. Kings rule. He is not a King.',
          effect:() => { mloy('murat',-5); res.morale = Math.min(100,res.morale+5); storyPath.push('murat_disciplined'); },
          outcome:'"You are angling for both, Sire. Always." His smile dims but does not break. Vanity is resilient. <em>(Murat -5 Loyalty · +5 Morale)</em>' },
      ],
      trigger:() => !fired.has('murats_plumage') && playerCount() >= 3 && res.turn >= 3,
    },

    // ══ CHAPTER II — THE ADVANCE BEGINS ══

    {
      id: 'continental_system',
      seal: '📜', source: 'Imperial Decree — 1806',
      title: 'The Continental System',
      body: `With several territories secured, an idea takes shape.\n\nA blockade. An economic empire. No British goods on European soil. Force London to its knees — not through battle, but through commerce.\n\nTalleyrand thinks it is brilliant. Ney thinks it is boring. Your treasury minister thinks it is complicated.\n\n<em>Do you sign the decree?</em>`,
      choices: [
        { label:'✒ Sign the Decree — Economic Warfare', sub:'Cut Britain off from the continent',
          effect:() => { res.gold += 800; mloy('talleyrand',+15); mloy('ney',-10); storyPath.push('economic'); },
          outcome:'The decree is signed. Ports close. British gold stops flowing east. But your own merchants grumble. <em>(+800 Gold · Talleyrand +15 · Ney -10)</em>' },
        { label:'⚔ Ignore Economics — Conquer Directly', sub:'Gold comes from conquest, not paperwork',
          effect:() => { res.army += 6000; mloy('ney',+10); mloy('talleyrand',-10); storyPath.push('aggressive'); },
          outcome:'The decree goes unsigned. The army grows instead. Ney approves. Talleyrand sighs quietly. <em>(+6,000 Army · Ney +10 · Talleyrand -10)</em>' },
        { label:'🤝 Negotiate — Partial Restrictions', sub:'A moderate, practical compromise',
          effect:() => { res.gold += 400; res.morale = Math.min(100,res.morale+5); storyPath.push('diplomatic'); },
          outcome:'A compromise is struck. Not everyone is happy — but no one is furious. <em>(+400 Gold · +5 Morale)</em>' },
      ],
      trigger:() => !fired.has('continental_system') && res.turn >= 4 && playerCount() >= 4,
    },

    {
      id: 'violet_ink',
      seal: '💀', source: 'Supply Report — Berthier to Bonaparte',
      title: 'The Violet Ink',
      body: `"A situation requiring monitoring, Sire," Berthier says. He uses that phrase for typhus and mutiny.\n\nHe spreads the map. New marks in violet ink stain the eastern territories — districts where the forage has failed completely. The horses are eating the thatch from peasant roofs. The bread wagons are three days behind.\n\n"If the snow thickens," Berthier says, his voice flat, "the violet will spread."\n\nThe violet ink looks darker in the fading light, almost black, like a stain that won't come out.\n\n<em>How does the Emperor feed his army?</em>`,
      choices: [
        { label:'📋 Redistribute — Pull from Reserves', sub:'Rob the rear to feed the front',
          effect:() => { res.gold -= 300; res.army += 2000; mloy('berthier',+10); storyPath.push('supply_managed'); },
          outcome:'Berthier moves the bread wagons. It costs gold, but the army eats tonight. The violet ink stops spreading — for now. <em>(-300 Gold · +2,000 Army · Berthier +10)</em>' },
        { label:'⚔ Forage Aggressively — Take from the Land', sub:'The locals will suffer. The army will march.',
          effect:() => { res.army += 4000; res.morale = Math.max(0,res.morale-8); storyPath.push('foraged'); },
          outcome:'The army feeds itself from the countryside. The peasants watch with eyes that are learning to hate. Morale cracks — not from hunger, but from what hunger makes men do. <em>(+4,000 Army · -8 Morale)</em>' },
        { label:'🕯 Negotiate Local Grain Purchases', sub:'Pay what the land is worth',
          effect:() => { res.gold -= 500; res.morale = Math.min(100,res.morale+5); mloy('talleyrand',+8); storyPath.push('grain_purchased'); },
          outcome:'Gold changes hands. The merchants are wary but the granaries open. It is not elegant, but it is honest. <em>(-500 Gold · +5 Morale · Talleyrand +8)</em>' },
      ],
      trigger:() => !fired.has('violet_ink') && playerCount() >= 5 && (res.army < 22000 || res.gold < 500),
    },

    {
      id: 'murats_crown',
      seal: '👑', source: 'Intercepted Dispatch — Naples',
      title: 'His Royal Highness, Joachim',
      body: `A heavy, cream-colored envelope bears Murat's seal. You break the wax. The signature at the bottom takes up nearly a third of the page: <em>His Royal Highness, Joachim Napoleon, King of Naples.</em>\n\n"He has no crown," you say, the words tasting like copper. "I have not given him a kingdom."\n\n"He is already holding court in the captured villas," Berthier says. "He has commissioned a new uniform. White velvet with gold egret feathers. He told the locals he is the vanguard of a new royalty."\n\n<em>The man is a peacock who thinks the sun rises to hear him crow.</em>`,
      choices: [
        { label:'👑 Grant the Crown — Bind Him', sub:'A King who owes his throne to you is safer than one who takes it himself',
          effect:() => { mloy('murat',+20); mglory('murat',15); storyPath.push('murat_crowned'); },
          outcome:'You sign the charter. Murat becomes what he has been performing — a King. He was always going to take a throne. Better it come from your hand. <em>(Murat +20 Loyalty · +15 Glory)</em>' },
        { label:'📋 Demote Him — "General Murat"', sub:'Use the title three times in the first paragraph',
          effect:() => { mloy('murat',-15); res.morale = Math.min(100,res.morale+5); storyPath.push('murat_demoted'); },
          outcome:'"Address it to General Murat. If he uses Royal Highness again, I will have his feathers plucked and his velvet used to patch the horses\' blankets." The dispatch is cold. Murat will not forget the temperature. <em>(Murat -15 Loyalty · +5 Morale)</em>' },
      ],
      trigger:() => !fired.has('murats_crown') && playerCount() >= 5 && res.turn >= 5,
    },

    {
      id: 'talleyrands_deal',
      seal: '🕯', source: 'Confidential — Vienna Negotiations',
      title: 'The Unauthorized Peace',
      body: `Talleyrand's script is like a spider's web — elegant, thin, and designed to trap. He has negotiated a separate peace with the Austrian envoys regarding the Italian border. He had no authority to speak for the Empire.\n\nThe terms are perfect. They secure the southern flank, stabilize the currency, and provide a buffer that would have taken three months of campaigning. It is a masterpiece of diplomacy.\n\nAnd he did it without you.\n\n<em>"Success that bypasses the throne is a subtle form of treason, Berthier. It's a rot that smells like roses."</em>`,
      choices: [
        { label:'📜 Accept the Terms — Through Your Office', sub:'Take credit. Let the Austrians think he was your messenger.',
          effect:() => { res.gold += 600; mloy('talleyrand',-5); storyPath.push('talleyrand_leashed'); },
          outcome:'The confirmation goes through your private office, not his. The Austrians will think he was merely the messenger, not the author. Talleyrand knows what you\'ve done. He does not complain. Men who serve four regimes know when to be quiet. <em>(+600 Gold · Talleyrand -5)</em>' },
        { label:'✗ Reject the Deal — Prove You Can', sub:'Ruin the peace to prove the Emperor is indispensable',
          effect:() => { res.army += 3000; mloy('talleyrand',-20); res.morale = Math.max(0,res.morale-5); storyPath.push('talleyrand_defied'); },
          outcome:'You tear up the treaty. Three months of campaigning await. But no one will forget who holds the pen. <em>(+3,000 Army · Talleyrand -20 · -5 Morale)</em>' },
      ],
      trigger:() => !fired.has('talleyrands_deal') && playerCount() >= 6 && MARSHALS.talleyrand.loyalty >= 40,
    },

    // ══ CHAPTER III — THE TIDE OF CONQUEST ══

    {
      id: 'ney_charges',
      seal: '🗡', source: "Marshal's Report — Ney to Bonaparte",
      title: 'The Bravest of the Brave',
      body: `Ney's dispatch arrives stiff with dried sleet. His handwriting, usually a frantic scrawl, is uncharacteristically precise. He took the city three days ago. You had ordered him to wait for heavy artillery. He ignored you.\n\nHe struck at dawn with half the allocated corps, bypassed the main gate, and turned the eastern wall before the sun cleared the horizon. Eleven hundred casualties were projected. He lost four hundred.\n\n"He wants me to see the ghost of the seven hundred men he saved," you mutter.\n\n<em>A man who wins without orders is more dangerous than a man who loses with them.</em>`,
      choices: [
        { label:'🗡 Grant Ney His Glory', sub:'Trust the marshal — genius validates disobedience',
          effect:() => {
            if (Math.random() > 0.3) {
              res.army += 3000; res.gold += 600; mglory('ney',20); mloy('ney',+10); storyPath.push('ney_triumph');
            } else {
              res.army = Math.max(0, res.army - 4000); res.morale = Math.max(0, res.morale-15); mloy('ney',-10); storyPath.push('ney_repulsed');
            }
          },
          outcome:'The dice are cast. Ney rides with a grin — a flash of white teeth in a face scarred by the refusal to be ordinary.' },
        { label:'📋 Leash Him — Hold Magdeburg', sub:'"He is not to move a single picket line without my written seal."',
          effect:() => { res.gold -= 200; res.army += 1000; mloy('berthier',+12); mloy('ney',-8); storyPath.push('ney_leashed'); },
          outcome:'"Tell him his report was received. Do not mention the city. Do not mention the casualties." Ney will be reminded — not rewarded, not punished — reminded who gives orders. <em>(-200 Gold · +1,000 Army · Berthier +12 · Ney -8)</em>' },
        { label:'🕯 Send Talleyrand to Parley', sub:'One letter may save a thousand lives',
          effect:() => { res.morale = Math.min(100,res.morale+10); mloy('talleyrand',+12); mloy('ney',-5); storyPath.push('parley'); },
          outcome:'A white flag is sent. The response is cold — but the garrison is smaller than the scouts reported. <em>(+10 Morale · Talleyrand +12 · Ney -5)</em>' },
      ],
      trigger:() => !fired.has('ney_charges') && res.turn >= 5 && playerCount() >= 7,
    },

    {
      id: 'josephines_roses',
      seal: '🌹', source: 'Personal Correspondence — Josephine to Napoleon',
      title: 'A Colour Between Red and Storm-Sky',
      body: `A letter from Paris. The wax seal is violet. Her handwriting flows with a heat that usually warms your chest. This time, the heat feels like a fever.\n\nShe writes of the east garden. The roses have bloomed — a shade somewhere between the red of a soldier's coat and the purple-grey of a sky before a storm.\n\nYou close your eyes and reach for the garden. You find nothing.\n\nYou can recall the angle of the sun at Austerlitz. You can recite the elevation of the heights at Marengo. But the garden where you once walked with her is a blur of grey.\n\nShe does not ask when you are returning. Every letter for ten years: <em>"When will the wind blow you back to me?"</em> This time? Roses. Soil. The weather.\n\n<em>Practicality is the language of people who have stopped waiting.</em>`,
      choices: [
        { label:'💌 Write Back — Describe the Roses You Cannot See', sub:'Lie beautifully. It is a kindness.',
          effect:() => { mloy('josephine',+12); res.morale = Math.min(100,res.morale+8); storyPath.push('described_roses'); },
          outcome:'You dip the pen and describe roses you cannot picture, a garden you cannot reach, a version of yourself that still walks there. The letter is beautiful. The lie is seamless. You have always been better at campaigns than confessions. <em>(+8 Morale · Josephine +12 Loyalty)</em>' },
        { label:'📋 Ask Berthier — "Is That a Colour a Man Can Actually See?"', sub:'Deflect. You are good at this.',
          effect:() => { mloy('berthier',+5); mloy('josephine',-5); storyPath.push('asked_berthier_roses'); },
          outcome:'Berthier blinks. "I couldn\'t say, Sire. I deal in terrain and tonnage."\n\n"Of course you do," you say. "We all do."\n\nYou return to the map. <em>(Berthier +5 · Josephine -5)</em>' },
        { label:'🗺 "The Next City." — Push the Letter Aside', sub:'If you read it again, the silence becomes permanent',
          effect:() => { res.army += 3000; mloy('josephine',-15); storyPath.push('ignored_roses'); },
          outcome:'You pick up the compasses. You fix the needle in the heart of a city you have never seen. You focus on the ink until the memory of a rose is nothing but a smudge of red in a world turning to winter. <em>(+3,000 Army · Josephine -15 Loyalty)</em>' },
      ],
      trigger:() => !fired.has('josephines_roses') && playerCount() >= 8 && res.turn >= 7,
    },

    {
      id: 'ney_without_orders',
      seal: '🗡', source: 'Field Report — Eastern Front',
      title: 'He Fought Without My Signature',
      body: `Ney fought at the bridgehead. He moved without your signature.\n\nHe won. The Russians are in retreat. "I took the bridgehead," Ney says, his voice booming too loud for this cold room. "They ran like scalded dogs."\n\nYou have the words of a court-martial in your throat. You can feel the weight of them — the logic, the necessity of order. If you do not break him now, the Marshals will become Kings before you are finished.\n\nBut he is looking at you the way he looked at you before Austerlitz. Before the doubt.\n\n<em>"There are no gaps I do not see first."</em>`,
      choices: [
        { label:'🗡 "Then we give them the horizon." — Forgive.', sub:'The army needs him more than discipline needs a lesson.',
          effect:() => { mloy('ney',+10); mglory('ney',12); res.morale = Math.min(100,res.morale+5); storyPath.push('ney_forgiven'); },
          outcome:'"Move the cavalry to the eastern flank. We end this before the sun reaches its zenith." Ney nods once and vanishes back into the dark. He is the most dangerous kind of soldier — the kind who fights for the void inside him. <em>(Ney +10 Loyalty · +12 Glory · +5 Morale)</em>' },
        { label:'📋 Court-Martial Proceedings', sub:'Order must be absolute. Even for heroes.',
          effect:() => { mloy('ney',-20); mloy('berthier',+8); res.morale = Math.max(0,res.morale-10); storyPath.push('ney_punished'); },
          outcome:'"The army is tired, Napoleon," Ney says. He uses your name, not your title. "They want to know what we are chasing."\n\nYou do not answer. The charges are filed. The army is quieter after that. <em>(Ney -20 Loyalty · Berthier +8 · -10 Morale)</em>' },
      ],
      trigger:() => !fired.has('ney_without_orders') && playerCount() >= 8 && MARSHALS.ney.glory >= 15,
    },

    // ══ CHAPTER IV — THE IMPERIAL ZENITH ══

    {
      id: 'ten_provinces',
      seal: '🗺', source: 'Command Tent — The Map Table',
      title: 'The Indigo Ink',
      body: `The indigo ink of the Empire has not yet dried on the tenth province. It spreads across the vellum like a slow, deliberate bruise, marking where your boots have trod and where your cannons have sung.\n\nYou stand over the map table in a room that smells of cold wax and damp stone. The ceiling is too high, the gilding too bright, the air too still. It is a room built for a man who doesn't exist anymore.\n\nYou are surrounded by the ghosts of the men you have made, and they all speak in the voices of monarchs.\n\n<em>I am at the centre of everything, and for the first time, I can feel the centre starting to pull.</em>`,
      choices: [
        { label:'🗺 Tighten the Grip — Consolidate the Empire', sub:'Every border secured. Every garrison doubled.',
          effect:() => { res.gold += 500; res.army += 2000; mloy('berthier',+10); storyPath.push('consolidated'); },
          outcome:'The orders go out: reinforce, resupply, retrench. The Empire is a magnificent engine. You intend to keep it polished. <em>(+500 Gold · +2,000 Army · Berthier +10)</em>' },
        { label:'⚔ Press Further — The Map Has Empty Spaces', sub:'Momentum is everything. The moment you sit, you sink.',
          effect:() => { res.army += 5000; res.morale = Math.max(0,res.morale-5); mloy('ney',+8); storyPath.push('pressed_on'); },
          outcome:'"The moment we sit, we sink." The army moves again. The gears turn at different speeds now — Ney winning his own wars, Murat dreaming his own palaces, Talleyrand ruling his own Europe. You are the architect, but they are beginning to believe they are the owners. <em>(+5,000 Army · -5 Morale · Ney +8)</em>' },
      ],
      trigger:() => !fired.has('ten_provinces') && playerCount() >= 10,
    },

    {
      id: 'berthier_almost_never',
      seal: '📜', source: 'Command Tent — Private Moment',
      title: 'The Reports Were Correct',
      body: `Berthier files the morning report. His uniform buttons catch the pale autumn light. Everything is exactly as you ordered. It has always been exactly as you ordered.\n\nHe stands at the heavy oak doors, waiting for a dismissal that is as routine as the sunrise.\n\nYou watch the way his ink-stained fingers twitch — precise, indispensable. He has written four years of letters to a woman in Munich that he has never sent. You can see the edges of them peeking from his breast pocket.\n\nYou have not said "well done" in three campaigns. The words are in your throat. They have been there longer than the war.\n\n<em>Do you say them?</em>`,
      choices: [
        { label:'📜 "It has always been correct, Berthier. I should have told you."', sub:'Four years late. But said.',
          effect:() => { mloy('berthier',+25); mglory('berthier',15); storyPath.push('acknowledged_berthier'); },
          outcome:'Berthier freezes. His quill drips a single glob of ink onto the edge of the map. His shoulders drop an inch.\n\n"The maps do not care for praise, Sire. Only for accuracy."\n\nBut he does not leave the tent for a long time after that. <em>(Berthier +25 Loyalty · +15 Glory)</em>' },
        { label:'⏩ "Leave it." — Return to the maps.', sub:'The words die behind your teeth. Again.',
          effect:() => { mloy('berthier',-8); storyPath.push('ignored_berthier'); },
          outcome:'The doors click shut. The silence that follows is louder than the drums of the Grande Armée.\n\nYou were beginning to notice the things you almost never did. <em>(Berthier -8 Loyalty)</em>' },
      ],
      trigger:() => !fired.has('berthier_almost_never') && playerCount() >= 10 && res.turn >= 8,
    },

    {
      id: 'talleyrands_warning',
      seal: '🕯', source: 'Private Audience — The Tall Windows',
      title: 'The Most Dangerous Kind of Soldier',
      body: `Talleyrand leans on his cane by the tall windows overlooking the courtyard. His eyes are unreadable as a frozen pond.\n\n"It is Ney who concerns me," he murmurs.\n\n"Ney is my bravest. He would charge the gates of hell if I gave him a horse and a whistle."\n\n"Exactly," Talleyrand says. "He is the most dangerous kind of soldier."\n\n"Because he does not fear death?"\n\n"No, Sire. Because Ney's bravery is not about France. And it is not about the campaign."\n\nHe stops. The silence hangs between you, jagged. You know what lies at the end of that thought. Ney's bravery is about the void — the need to be the last man standing in a world he helped burn down.\n\n<em>He isn't fighting for you. He is fighting for the moment the bullet finally finds a way to stop his heart.</em>`,
      choices: [
        { label:'🗡 Talk to Ney — Before It Is Too Late', sub:'A man drowning in glory can still be reached.',
          effect:() => { mloy('ney',+12); mloy('talleyrand',+5); storyPath.push('reached_ney'); },
          outcome:'You find Ney sharpening his saber outside the tent. You sit, and for the first time in the campaign, you do not talk about the war. He is surprised. Then he is not. Then he is quiet in a way that sounds like the beginning of something. <em>(Ney +12 Loyalty · Talleyrand +5)</em>' },
        { label:'⏩ Dismiss — "He fights. That is enough."', sub:'Some men cannot be saved from themselves.',
          effect:() => { mloy('talleyrand',-5); storyPath.push('ignored_ney_warning'); },
          outcome:'Talleyrand nods, once. He turns from the window. He has served four regimes. He knows the sound a man makes when he has chosen not to listen. <em>(Talleyrand -5)</em>' },
      ],
      trigger:() => !fired.has('talleyrands_warning') && playerCount() >= 10 && MARSHALS.ney.glory >= 25,
    },

    {
      id: 'the_unopened_letter',
      seal: '💌', source: 'Personal — The Writing Desk',
      title: 'The Next Thing',
      body: `Josephine's letter sits on the blotter, perfectly aligned with the edge of the desk. The wax seal is deep, blood-red. You have reached for it four times since the sun hit the meridian.\n\nEach time, something intervened. A courier from the vanguard. A dispute over grain prices. The bridge schematics. The next thing.\n\nThere is always a next thing — a relentless tide of trivialities that demand the Emperor's hand so the man can remain buried.\n\nThe seal stares up at you. If you open it, you will have to be the man who misses the garden. If you put it down, you remain the man who moves the world.\n\n<em>The next thing is always more comfortable than the last.</em>`,
      choices: [
        { label:'💌 Open the Letter', sub:'Be the man. Not the Emperor. For one moment.',
          effect:() => { mloy('josephine',+18); res.morale = Math.min(100,res.morale+10); storyPath.push('opened_letter'); },
          outcome:'You break the seal. She writes of the garden, the light, the sound of rain on the windows of the Rue de la Victoire. She writes: "I do not need you to come home. I need you to remember that home exists."\n\nYou sit with the letter for a long time. <em>(Josephine +18 Loyalty · +10 Morale)</em>' },
        { label:'🗺 "The schematics." — Walk Away.', sub:'The seal remains unbroken. The man remains buried.',
          effect:() => { res.army += 3000; mloy('josephine',-18); storyPath.push('letter_unopened'); },
          outcome:'You lay the letter back on the blotter, perfectly aligned with the edge of the desk. You do not look back as you walk toward the door. The high ceilings swallow the sound of your boots.\n\n"Tell the engineers I am coming." <em>(+3,000 Army · Josephine -18 Loyalty)</em>' },
      ],
      trigger:() => !fired.has('the_unopened_letter') && playerCount() >= 11 && res.turn >= 9,
    },

    // ══ CHAPTER V — THE FINAL RECKONING ══

    {
      id: 'road_to_moscow',
      seal: '❄', source: 'Strategic Council — Warsaw, 1812',
      title: 'The Road to Moscow',
      body: `Warsaw is behind you. Ahead lies the vast eastern plain, and beyond it — Moscow.\n\nYour generals are divided as never before. Ney wants to march. Berthier shakes his head at the supply maps. Talleyrand has requested a private audience, which is never a good sign.\n\nThe Tsar has not sued for peace. The Russian army retreats but does not break. They are drawing you east, into cold and distance.\n\n<em>How does the Emperor respond to the abyss?</em>`,
      choices: [
        { label:'❄ March on Moscow — End It', sub:'History belongs to those who dare',
          effect:() => { res.army = Math.max(0, res.army-8000); res.morale = Math.min(100,res.morale+10); mloy('ney',+15); mloy('berthier',-20); storyPath.push('moscow_march'); },
          outcome:'The army marches east. The road stretches further than any map suggests. But the Eagle has never retreated. <em>(-8,000 Army · +10 Morale · Ney +15 · Berthier -20)</em>' },
        { label:'🕯 Halt at Warsaw — Offer the Tsar Terms', sub:'A negotiated peace is still victory',
          effect:() => { res.gold += 1200; res.morale = Math.min(100,res.morale+8); mloy('talleyrand',+20); mloy('ney',-15); storyPath.push('warsaw_peace'); },
          outcome:'Talleyrand drafts the terms. It is not the conquest the army dreamed of, but it is an empire that will last. <em>(+1,200 Gold · +8 Morale · Talleyrand +20 · Ney -15)</em>' },
        { label:"👑 Propose a Dynasty — Marry into the Tsar's Family", sub:'Bloodlines conquer what armies cannot hold',
          effect:() => { res.gold += 600; res.morale = Math.min(100,res.morale+15); mloy('josephine',-20); mloy('talleyrand',+10); storyPath.push('dynastic'); },
          outcome:'The proposal is audacious. If it works, the Bonaparte name outlasts the Empire. <em>(+600 Gold · +15 Morale · Josephine -20 · Talleyrand +10)</em>' },
      ],
      trigger:() => !fired.has('road_to_moscow') && (playerCount() >= 12 || res.turn >= 10),
    },

    {
      id: 'final_truth',
      seal: '💌', source: 'Command Tent — The Final Night',
      title: 'A Final Truth',
      body: `The frost bites at the canvas. Berthier's shadow stretches across the final map of Europe, his quill hovering over the last slivers of white territory.\n\nYou reach into your coat. Your fingers brush the crisp edge of a letter — one you have been writing in your head for the duration of the campaign. Not orders. Not terms. Not strategy.\n\nA truth.\n\nTo the house in the Rue de la Victoire. To the woman whose laugh you stored somewhere you could reach and have been reaching for, more and more, as the guns grow louder.\n\n<em>As soon as the last flag falls, the courier rides. Not for the Senate. Not for the palace.</em>`,
      choices: [
        { label:'💌 Send the Letter — To the Rue de la Victoire', sub:'"Find a courier. One with the fastest horse in the stable."',
          effect:() => { mloy('josephine',+25); res.morale = Math.min(100,res.morale+15); storyPath.push('sent_final_letter'); },
          outcome:'"He waits at the edge of the smoke," you tell Berthier. "As soon as the last flag falls, he rides for Paris. Not for the Senate. Not for the palace. To the house in the Rue de la Victoire."\n\nBerthier takes the letter as if it were made of glass. <em>(Josephine +25 Loyalty · +15 Morale)</em>' },
        { label:'🗺 Hold the Letter — The Campaign Comes First', sub:'There will be time after. There is always after.',
          effect:() => { res.army += 3000; mloy('josephine',-10); storyPath.push('held_letter'); },
          outcome:'You put the letter back in your coat. The campaign is not finished. The letter can wait.\n\nIt can always wait. <em>(+3,000 Army · Josephine -10)</em>' },
      ],
      trigger:() => !fired.has('final_truth') && playerCount() >= 13 && res.turn >= 10,
    },

    {
      id: 'berthier_worth_it',
      seal: '📜', source: 'Command Tent — Before the Last Battle',
      title: 'Is It Worth It?',
      body: `The horizon is beginning to grey. The silhouettes of fifty thousand men rise like ghosts from the frozen earth. The sound of a distant trumpet cuts through the cold, sharp and final.\n\nBerthier's voice comes from the shadows behind you.\n\n<em>"Is it worth it, Sire? The whole map?"</em>\n\nYou close your eyes. You do not see the lines of infantry. You see the east garden. You hear the sound of her laugh — ordinary, specific, and loud enough to drown out the coming guns.`,
      choices: [
        { label:'🌹 "The map is just paper, Berthier."', sub:'"The laugh is the only thing that was ever real."',
          effect:() => { mloy('berthier',+10); mloy('josephine',+10); res.morale = Math.min(100,res.morale+10); storyPath.push('map_is_paper'); },
          outcome:'Berthier is quiet for a long time. Then he picks up his quill and draws the final line on the map with the same precision he has brought to every report, every supply chain, every seventeen-copy set of maps.\n\nHe has never heard you say anything like that before. <em>(Berthier +10 · Josephine +10 · +10 Morale)</em>' },
        { label:'⚔ "Ask me after the victory."', sub:'The Emperor speaks. The man stays silent.',
          effect:() => { res.army += 2000; storyPath.push('asked_after'); },
          outcome:'"Prepare the carriage for dawn. I want to be at the front." The question hangs in the tent like smoke. You did not answer it. Perhaps that is the answer. <em>(+2,000 Army)</em>' },
      ],
      trigger:() => !fired.has('berthier_worth_it') && playerCount() >= 14,
    },

  ];

  // ── ENGINE ──────────────────────────────────────────────────
  function check() {
    updateChapter();
    let added = 0;
    for (const ev of EVENTS) {
      if (!fired.has(ev.id) && ev.trigger()) {
        queue.push(ev);
        fired.add(ev.id);
        added++;
        if (added >= 1) break;
      }
    }
    if (!isOpen && queue.length) show(queue.shift());
  }

  function updateChapter() {
    const newChapter = getChapter();
    const owned = playerCount();
    const chapters = [
      [1,  'CHAPTER I — THE EAGLE AWAKENS'],
      [4,  'CHAPTER II — THE ADVANCE BEGINS'],
      [7,  'CHAPTER III — THE TIDE OF CONQUEST'],
      [10, 'CHAPTER IV — THE IMPERIAL ZENITH'],
      [13, 'CHAPTER V — THE FINAL RECKONING'],
    ];
    let label = chapters[0][1];
    for (const [req, ch] of chapters) { if (owned >= req) label = ch; }
    document.getElementById('chapter-hud').textContent = '⚜ ' + label;

    // Chapter transition cinematic
    if (newChapter !== currentChapter && newChapter > currentChapter) {
      currentChapter = newChapter;
      showChapterTransition(newChapter);
    }
  }

  function showChapterTransition(chapterNum) {
    const ch = CHAPTERS[chapterNum];
    if (!ch) return;

    const overlay = document.getElementById('chapter-transition');
    document.getElementById('ch-numeral').textContent = ch.numeral;
    document.getElementById('ch-name').textContent = ch.name;
    document.getElementById('ch-epigraph').textContent = ch.epigraph;

    overlay.classList.add('active');

    setTimeout(() => {
      overlay.classList.remove('active');
    }, 4200);
  }

  function show(ev) {
    isOpen = true;
    document.getElementById('story-ornament').textContent = ev.seal || '⚜';
    document.getElementById('story-source').textContent   = ev.source;
    document.getElementById('story-title').textContent    = ev.title;
    document.getElementById('story-body').innerHTML       = ev.body.split('\\n\\n').join('<br><br>').split('\\n').join('<br>');

    const cEl      = document.getElementById('story-choices');
    const conseqEl = document.getElementById('story-consequence');
    const contBtn  = document.getElementById('story-continue');

    cEl.innerHTML          = '';
    cEl.style.display      = 'flex';
    conseqEl.style.display = 'none';
    contBtn.style.display  = 'none';

    ev.choices.forEach(ch => {
      const btn = document.createElement('button');
      btn.className = 'story-choice';
      btn.innerHTML = `<div class="sc-label">${ch.label}</div><div class="sc-sub">${ch.sub}</div>`;
      btn.onclick = () => {
        ch.effect();
        updateRes();
        renderMap();
        syncBackend();
        cEl.style.display      = 'none';
        conseqEl.innerHTML     = ch.outcome;
        conseqEl.style.display = 'block';
        contBtn.style.display  = 'block';
        log(`[Story] ${ch.label}`, 'algo');
      };
      cEl.appendChild(btn);
    });

    document.getElementById('story-modal').style.display = 'flex';
  }

  function close() {
    document.getElementById('story-modal').style.display = 'none';
    document.getElementById('story-choices').style.display = 'flex';
    isOpen = false;
    updateMarshals();
    if (queue.length) setTimeout(() => show(queue.shift()), 800);
  }

  function reset() {
    fired     = new Set();
    queue     = [];
    isOpen    = false;
    storyPath = [];
    currentChapter = 1;

    Object.assign(MARSHALS.murat,      { loyalty:80, alive:true, glory:0 });
    Object.assign(MARSHALS.ney,        { loyalty:90, alive:true, glory:0 });
    Object.assign(MARSHALS.berthier,   { loyalty:75, alive:true, glory:0 });
    Object.assign(MARSHALS.talleyrand, { loyalty:55, alive:true, glory:0 });
    Object.assign(MARSHALS.josephine,  { loyalty:70, alive:true, glory:0 });

    document.getElementById('story-modal').style.display   = 'none';
    document.getElementById('story-choices').style.display = 'flex';
    document.getElementById('chapter-hud').textContent     = '⚜ CHAPTER I — THE EAGLE AWAKENS';
    document.getElementById('chapter-transition').classList.remove('active');
    updateMarshals();
  }

  // ── MARSHAL DISPLAY ─────────────────────────────────────────
  function updateMarshals() {
    const list = document.getElementById('marshal-list');
    if (!list) return;
    list.innerHTML = '';
    const ch = getChapter();

    Object.entries(MARSHALS).forEach(([id, m]) => {
      const st  = marshalStatus(m);
      const row = document.createElement('div');
      row.className = 'marshal-row';
      row.innerHTML = `
        <div class="m-avatar${m.alive ? '' : ' dead'}">${m.emoji}</div>
        <div class="m-info">
          <div class="m-name">${m.name}</div>
          <div class="m-title">${m.title}</div>
        </div>
        <div class="m-bars">
          <div class="m-bar-wrap" title="Loyalty: ${m.loyalty}%">
            <div class="m-bar-fill loyalty" style="width:${m.loyalty}%"></div>
          </div>
          <div class="m-bar-wrap" title="Glory: ${m.glory}">
            <div class="m-bar-fill glory" style="width:${Math.min(100, m.glory*2)}%"></div>
          </div>
          <div class="m-legend"><span>Loy</span><span>Glo</span></div>
        </div>
        <span class="m-status ${st.cls}">${st.label}</span>`;
      list.appendChild(row);
    });
  }

  // ── WIN SCREEN PERSONALISATION ──────────────────────────────
  function getPersonalisedEnding() {
    const path = storyPath;
    const ms = MARSHALS;

    // Opening paragraph based on dominant play style
    const aggressiveCount = path.filter(p => ['aggressive','decisive','pressed_on','moscow_march'].includes(p)).length;
    const diplomaticCount = path.filter(p => ['diplomatic','economic','parley','warsaw_peace'].includes(p)).length;
    const strategicCount  = path.filter(p => ['strategic','cautious','consolidated','siege','supply_managed'].includes(p)).length;

    let openingParagraph;
    if (aggressiveCount >= diplomaticCount && aggressiveCount >= strategicCount) {
      openingParagraph = 'You marched until the continent ran out of borders. Every city fell because you arrived before doubt could. The map of Europe is yours — drawn in French ink, bought with French blood, and held together by the will of a single man who never learned how to stop.';
    } else if (diplomaticCount >= aggressiveCount && diplomaticCount >= strategicCount) {
      openingParagraph = 'You negotiated where others would have fought. Treaties replaced battles. Talleyrand\'s pen conquered what cavalry could not hold. Europe did not fall — it was persuaded, city by city, letter by letter, until the borders were yours and the bloodshed was someone else\'s story.';
    } else {
      openingParagraph = 'Berthier\'s maps were never wrong. You followed the shortest path through a continent — every march calculated, every supply line drawn before the first boot touched the road. Europe fell to logistics, not glory, and the precision of that is its own kind of beauty.';
    }

    // Marshal beats
    const marshalBeats = [];

    // Ney
    if (ms.ney.glory >= 40) {
      marshalBeats.push({ id:'ney', emoji:'🗡', name:'Ney', status: marshalStatus(ms.ney),
        prose: 'Ney stands outside the tent. He has not spoken in an hour. That is how you know he is still here — the bravest of the brave, standing guard over a victory he no longer needs to prove.' });
    } else if (ms.ney.loyalty >= 75) {
      marshalBeats.push({ id:'ney', emoji:'🗡', name:'Ney', status: marshalStatus(ms.ney),
        prose: 'Ney cleans his saber in the firelight. The campaign is over, but his hands still need the motion. Some men are not built for peacetime. Some men carry the war inside them long after the treaties are signed.' });
    } else if (ms.ney.loyalty >= 45) {
      marshalBeats.push({ id:'ney', emoji:'🗡', name:'Ney', status: marshalStatus(ms.ney),
        prose: 'Ney disappears into the crowd before the speeches begin. He was always more comfortable in the chaos than the ceremony. You wonder if you will see him again. You wonder if he wonders the same.' });
    } else {
      marshalBeats.push({ id:'ney', emoji:'🗡', name:'Ney', status: marshalStatus(ms.ney),
        prose: 'You look for Ney in the crowd and do not find him. His absence is louder than the guns that won this war. The bravest of the brave, and he is not here. Perhaps that is the bravest thing of all.' });
    }

    // Berthier
    if (path.includes('acknowledged_berthier')) {
      marshalBeats.push({ id:'berthier', emoji:'📜', name:'Berthier', status: marshalStatus(ms.berthier),
        prose: 'Berthier\'s final report was correct, as it always was. You told him so. Once. He did not need to hear it. But you needed to have said it.' });
    } else {
      marshalBeats.push({ id:'berthier', emoji:'📜', name:'Berthier', status: marshalStatus(ms.berthier),
        prose: 'Berthier files the last report. It is correct. You do not tell him this. You have never told him this. His hand is steady. After all these years, his hand is the steadiest thing in the Empire.' });
    }

    // Murat
    if (path.includes('murat_crowned')) {
      marshalBeats.push({ id:'murat', emoji:'🐎', name:'Murat', status: marshalStatus(ms.murat),
        prose: 'Murat rides through Naples in white velvet and gold feathers. He is the King you made. Whether he remembers who placed the crown is a question for another decade.' });
    } else if (ms.murat.loyalty >= 60) {
      marshalBeats.push({ id:'murat', emoji:'🐎', name:'Murat', status: marshalStatus(ms.murat),
        prose: 'Murat adjusts his uniform for the victory parade — gold lace, crimson velvet, the peacock feather. Some things do not change. The vanity is the same. Only now he has earned it.' });
    } else {
      marshalBeats.push({ id:'murat', emoji:'🐎', name:'Murat', status: marshalStatus(ms.murat),
        prose: 'Murat\'s white stallion is dusty. The gold lace is frayed. He still looks like a king, but his eyes have the quiet calculation of a man who is wondering what comes next. You gave him everything except the one thing he wanted most — a throne of his own.' });
    }

    // Talleyrand
    marshalBeats.push({ id:'talleyrand', emoji:'🕯', name:'Talleyrand', status: marshalStatus(ms.talleyrand),
      prose: ms.talleyrand.loyalty >= 60
        ? 'Talleyrand watches from the shadows, his cane catching the light. He has served four regimes. For the first time, he appears to believe this one might last. That is either the highest compliment or the most dangerous omen.'
        : 'Talleyrand watches from the shadows, as he always has. He will serve the next regime with the same cold brilliance. That is the most unsettling thing about him — he never changes.' });

    // Josephine
    if (path.includes('sent_final_letter')) {
      marshalBeats.push({ id:'josephine', emoji:'💌', name:'Josephine', status: marshalStatus(ms.josephine),
        prose: 'A courier waits at the edge of the smoke. As soon as the last flag falls, he rides — not for the Senate, not for the palace — to the house in the Rue de la Victoire. He carries a letter that says what the campaign could not.' });
    } else if (path.includes('described_roses') || path.includes('opened_letter')) {
      marshalBeats.push({ id:'josephine', emoji:'💌', name:'Josephine', status: marshalStatus(ms.josephine),
        prose: 'You close your eyes and see the east garden. The roses are blooming — a shade between red and the sky before a storm. You can see them now. The campaign is over, and the garden has returned.' });
    } else if (path.includes('letter_unopened') || path.includes('ignored_roses')) {
      marshalBeats.push({ id:'josephine', emoji:'💌', name:'Josephine', status: marshalStatus(ms.josephine),
        prose: 'Josephine\'s letter sits on the desk. The seal is unbroken. You kept meaning to open it after the next thing. There was always a next thing. The campaign is over. There are no next things left. Just the letter, and the silence, and the sound of a garden you can no longer picture.' });
    } else {
      marshalBeats.push({ id:'josephine', emoji:'💌', name:'Josephine', status: marshalStatus(ms.josephine),
        prose: 'You think of Josephine. The gardens at Malmaison. The roses. You try to picture the path, the way the light hit the fountain. The image comes slowly, like a letter from a great distance.' });
    }

    return { openingParagraph, marshalBeats };
  }

  // ── MARSHAL HELPERS ─────────────────────────────────────────
  function getMarshalSummary() {
    const alive = Object.values(MARSHALS).filter(m => m.alive);
    return {
      loyal:   alive.filter(m => m.loyalty >= 75).map(m => m.name),
      legends: alive.filter(m => m.glory   >= 40).map(m => m.name),
      hostile: alive.filter(m => m.loyalty <  45).map(m => m.name),
      fallen:  Object.values(MARSHALS).filter(m => !m.alive).map(m => m.name),
    };
  }

  function getMarshals() { return MARSHALS; }

  function grantMarshalGlory(id, amount) {
    mglory(id, amount);
    updateMarshals();
  }

  function marshalLoyaltyHit(id, amount) {
    mloy(id, amount);
    updateMarshals();
  }

  function boostRandomMarshal(glory) {
    const eligible = Object.entries(MARSHALS)
      .filter(([,m]) => m.alive && m.glory < 40)
      .sort(([,a],[,b]) => b.loyalty - a.loyalty);
    if (eligible.length) {
      mglory(eligible[0][0], glory);
      updateMarshals();
    }
  }

  function getPath() { return storyPath; }
  function getCurrentChapter() { return getChapter(); }

  return {
    check,
    close,
    reset,
    getPath,
    getMarshals,
    getChapter: getCurrentChapter,
    updateChapter,
    updateMarshals,
    getMarshalSummary,
    getPersonalisedEnding,
    grantMarshalGlory,
    marshalLoyaltyHit,
    boostRandomMarshal,
    marshalStatus,
  };

})();

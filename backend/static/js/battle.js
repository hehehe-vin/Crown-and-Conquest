/* ══════════════════════════════════════════════════════════════
   battle.js  ·  Crown & Conquest — DAA-IV-T241
   Battle system: probability display, army commitment,
   marshal abilities, animated battle bar, loot rolls.
══════════════════════════════════════════════════════════════ */

// ── GAME BALANCE STATE ─────────────────────────────────────────
const attackCooldowns = {};      // { territoryId: turnWhenCooldownExpires }
let recruitedThisTurn = false;   // Reset each turn
let peakTerritories = 1;         // Highest territory count reached (for morale bleed)

// Capital gate requirements: territory ID → minimum territories needed
const CAPITAL_GATES = {
  5: 4,    // Berlin — need 4 territories
  8: 7,    // Vienna — need 7 territories
  13: 9,   // Warsaw — need 9 territories
  14: 13,  // Moscow — need ALL others (13 out of 15)
};

// Terrain defense multipliers
const TERRAIN_MULT = {
  city: 1.0,
  fort: 1.15,
  capital: 1.25,
};

// ── TERRITORY SELECTION ─────────────────────────────────────────
function selectT(id) {
  if (running) return;
  if (selId !== null) setNS(selId, getEffectiveState(T[selId]));
  selId = id;
  setNS(id, 'selected');
  updateInfoPanel(id);
  refreshConqBtn(id);
}

// ── CONQUER DISPATCHER ──────────────────────────────────────────
function conquerSelected() {
  if (selId === null) return;
  const t = T[selId];

  if (t.owner === 'player') {
    toast('Already under Imperial control.');
    return;
  }

  const reachable = getReachable();
  if (!reachable.includes(selId)) {
    toast('No supply line — territory not adjacent!');
    return;
  }

  if (!t.revealed) {
    toast('Scout this territory first!');
    return;
  }

  const cg = t.cost * 50;
  // Minimum resource check uses 25% commit (smallest option) so player is never falsely blocked
  const minArmyCost = Math.floor(res.army * 0.25 * 0.15);

  if (res.gold < cg) {
    toast(`Need ${cg}g — only ${res.gold}g available.`);
    log(`Insufficient gold for ${t.name}. Need ${cg}g.`, 'defeat');
    return;
  }
  if (res.army < minArmyCost + 500) {
    toast('Army too depleted to attack!');
    log(`Army too small to mount an offensive on ${t.name}.`, 'defeat');
    return;
  }

  // ── BFS-SCAN CHECK ──
  if (!t.bfsScanned) {
    toast('Territory not scouted — run BFS first!');
    log(`Cannot attack ${t.name} — territory has not been reconnaissance-scanned.`, 'defeat');
    return;
  }

  // ── ATTACK COOLDOWN CHECK ──
  if (attackCooldowns[selId] && res.turn < attackCooldowns[selId]) {
    toast('Forces regrouping — cannot attack this turn.');
    log(`${t.name}: attack cooldown active until turn ${attackCooldowns[selId]}.`, 'info');
    return;
  }

  // ── CAPITAL GATE CHECK ──
  if (t.type === 'capital' && t.owner === 'enemy' && CAPITAL_GATES[selId]) {
    const required = CAPITAL_GATES[selId];
    const owned = T.filter(t => t.owner === 'player').length;
    if (owned < required) {
      toast(`Need ${required} territories before attacking ${t.name}.`);
      log(`${t.name} is fortified — requires ${required} territories under Imperial control.`, 'info');
      return;
    }
  }

  // Open the battle modal for all attacks
  openBattle(t);
}

// ── OPEN BATTLE MODAL ───────────────────────────────────────────
function openBattle(t) {
  // Reset per-battle state
  battleState.commitFraction = 1.0;
  battleState.marshalAbility = null;

  document.getElementById('btl-name').textContent = t.name;
  document.getElementById('btl-result').textContent = 'The fate of Europe hangs in the balance.';
  document.getElementById('btl-result').className = 'bresult bneutral';
  document.getElementById('btl-loot').classList.remove('show');
  document.getElementById('btl-advance').disabled = false;

  // Reset the battle animation bar to idle state
  const anim = document.getElementById('btl-anim-fill');
  if (anim) anim.classList.remove('running');

  updateBattleOddsDisplay(t);
  renderCommitButtons(t);
  renderMarshalAbilities(t);
  initBattleAdvance(t);

  ScreenQueue.push('battle',
    () => { document.getElementById('battle-modal').style.display = 'flex'; },
    {
      hideFn: () => { document.getElementById('battle-modal').style.display = 'none'; },
      cinematic: {
        type: 'battle',
        title: `Battle for ${t.name}`,
        subtitle: 'Steel meets destiny.',
        kicker: 'War Council',
      },
    }
  );
}

// ── BATTLE ODDS DISPLAY ─────────────────────────────────────────
function updateBattleOddsDisplay(t) {
  const atkStrength = Math.max(1, Math.floor(res.army * battleState.commitFraction * 0.6));
  const moraleMult  = 0.7 + (res.morale / 100) * 0.6;
  const dfsMult     = t.dfsScanned ? 1.15 : 1.0;
  const dijkMult    = t.onDijkstraPath ? 1.10 : 1.0;
  const mod         = getMarshalModifier(t);
  const effAtk      = atkStrength * moraleMult * dfsMult * dijkMult * mod.atkMult;

  const terrainMult = TERRAIN_MULT[t.type] || 1.0;
  const effDef      = t.units * terrainMult;

  document.getElementById('btl-atk').textContent = Math.floor(effAtk).toLocaleString();

  /** Convert a strength ratio to a readable win percentage (0–99) */
  function ratioPct(r) { return Math.min(99, Math.max(1, Math.round((r / (r + 1)) * 100))); }

  if (t.dfsScanned) {
    // ── EXACT INTEL ──
    document.getElementById('btl-def').textContent = Math.floor(effDef).toLocaleString();

    const ratio = effAtk / Math.max(1, effDef);
    const pct   = ratioPct(ratio);
    const fill  = document.getElementById('odds-fill');
    let outcome, barColor;

    if (ratio > 1.3) {
      outcome = 'Decisive Victory'; barColor = '#7ab870';
    } else if (ratio > 1.0) {
      outcome = 'Close Victory'; barColor = '#a8c76a';
    } else if (ratio > 0.7) {
      outcome = 'Defeat Likely'; barColor = '#e9c176';
    } else {
      outcome = 'Crushing Defeat'; barColor = '#f87171';
    }

    fill.style.width = `${Math.min(95, Math.max(5, pct))}%`;
    fill.style.background = barColor;
    document.getElementById('odds-win').textContent = `${outcome} · ${pct}%`;
    document.getElementById('odds-win').style.color = barColor;
    document.getElementById('odds-lose').textContent = ratio > 1.0 ? '✓ Confirmed' : '✗ Outmatched';
    document.getElementById('odds-lose').style.color = ratio > 1.0 ? '#7ab870' : '#f87171';

  } else {
    // ── ESTIMATED INTEL (no DFS) ──
    const g = getGarrisonDisplay(t);
    document.getElementById('btl-def').textContent = g.label + ' ⚠';

    const bestRatio  = effAtk / Math.max(1, g.min * terrainMult);
    const worstRatio = effAtk / Math.max(1, g.max * terrainMult);

    const bestPct  = ratioPct(bestRatio);
    const worstPct = ratioPct(worstRatio);
    const avgPct   = Math.round((bestPct + worstPct) / 2);

    const fill = document.getElementById('odds-fill');
    fill.style.width = `${Math.min(95, Math.max(5, avgPct))}%`;
    fill.style.background = 'linear-gradient(90deg, #f87171, #e9c176, #7ab870)';

    // Outcome label based on whether worst case still wins
    let outcomeLabel;
    if (worstPct > 55) {
      outcomeLabel = 'Victory Likely';
    } else if (bestPct > 55 && worstPct <= 55) {
      outcomeLabel = 'Uncertain';
    } else {
      outcomeLabel = 'Defeat Likely';
    }

    document.getElementById('odds-win').textContent = `${worstPct}–${bestPct}%  ·  ${outcomeLabel}`;
    document.getElementById('odds-win').style.color = worstPct > 55 ? '#a8c76a' : bestPct > 55 ? '#e9c176' : '#f87171';
    document.getElementById('odds-lose').textContent = '⚠ Unconfirmed';
    document.getElementById('odds-lose').style.color = '#e9c176';
  }
}

// ── COMMIT BUTTONS ──────────────────────────────────────────────
function renderCommitButtons(t) {
  const wrap = document.getElementById('commit-btns');
  wrap.innerHTML = '';
  const options = [
    { label: '¼ Force', val: 0.25 },
    { label: '½ Force', val: 0.5  },
    { label: '¾ Force', val: 0.75 },
    { label: 'Full',    val: 1.0  },
  ];
  options.forEach(opt => {
    const b = document.createElement('button');
    b.className = `commit-btn${battleState.commitFraction === opt.val ? ' active' : ''}`;
    b.textContent = opt.label;
    b.onclick = () => {
      battleState.commitFraction = opt.val;
      wrap.querySelectorAll('.commit-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      updateBattleOddsDisplay(t);
      // Update info panel win chance too
      updateInfoPanel(selId);
    };
    wrap.appendChild(b);
  });
}

// ── MARSHAL ABILITIES ───────────────────────────────────────────
const MARSHAL_ABILITIES = {
  ney: {
    label: '🗡 Ney: Brave Assault',
    desc:  '+25% win / ×2 loss on defeat',
    apply: (t) => ({ atkMult: 1.25, lossMultOnDefeat: 2.0, tag: 'ney' }),
    condition: (m) => m.loyalty >= 60,
  },
  berthier: {
    label: '📜 Berthier: Tactical Siege',
    desc:  '+15% win · costs 200g extra',
    apply: (t) => ({ atkMult: 1.15, goldCostExtra: 200, tag: 'berthier' }),
    condition: (m) => m.loyalty >= 50,
  },
  murat: {
    label: '🐎 Murat: Cavalry Charge',
    desc:  '+20% vs cities / -5% vs forts',
    apply: (t) => {
      const mult = t.type === 'city' ? 1.20 : t.type === 'fort' ? 0.95 : 1.08;
      return { atkMult: mult, tag: 'murat' };
    },
    condition: (m) => m.loyalty >= 55,
  },
  talleyrand: {
    label: '🕯 Talleyrand: Parley',
    desc:  '30% chance of bloodless victory',
    apply: (t) => ({ atkMult: 1.0, bloodlessChance: 0.3, tag: 'talleyrand' }),
    condition: (m) => m.loyalty >= 45,
  },
};

function renderMarshalAbilities(t) {
  const wrap = document.getElementById('marshal-ability-row');
  wrap.innerHTML = '';
  const marshals = Story.getMarshals();

  Object.entries(MARSHAL_ABILITIES).forEach(([key, ability]) => {
    const m = marshals[key];
    if (!m || !m.alive) return;

    const b = document.createElement('button');
    b.className = 'marshal-ability-btn';
    const available = ability.condition(m);
    b.disabled = !available;
    if (!available) b.classList.add('used');

    b.innerHTML = `<div style="font-size:.62rem">${ability.label.split(':')[0]}</div>
                   <div style="font-size:.5rem;opacity:.7;margin-top:1px">${ability.desc}</div>`;

    b.title = available ? ability.label : `Requires loyalty ≥ ${ability.condition.toString().match(/\d+/)?.[0]}`;

    b.onclick = () => {
      battleState.marshalAbility = battleState.marshalAbility === key ? null : key;
      wrap.querySelectorAll('.marshal-ability-btn').forEach(x => x.classList.remove('active'));
      if (battleState.marshalAbility) b.classList.add('active');
      updateBattleOddsDisplay(t);
    };

    wrap.appendChild(b);
  });
}

/** Returns attack multiplier and special effects for current marshal ability */
function getMarshalModifier(t) {
  if (!battleState.marshalAbility) return { atkMult: 1.0 };
  const ability = MARSHAL_ABILITIES[battleState.marshalAbility];
  if (!ability) return { atkMult: 1.0 };
  return ability.apply(t);
}

// ── BATTLE RESOLUTION ──────────────────────────────────────────
function initBattleAdvance(t) {
  const advBtn = document.getElementById('btl-advance');
  advBtn.onclick = () => resolveBattle(t);
}

function resolveBattle(t) {
  const advBtn = document.getElementById('btl-advance');
  advBtn.disabled = true;

  const mod         = getMarshalModifier(t);
  const goldExtra   = mod.goldCostExtra || 0;
  const lossMultDef = mod.lossMultOnDefeat || 1.0;
  const bloodless   = mod.bloodlessChance || 0;

  // ── COMPUTE STRENGTH ──
  const committed   = Math.floor(res.army * battleState.commitFraction);
  const atkStrength = Math.max(1, Math.floor(committed * 0.6));
  const moraleMult  = 0.7 + (res.morale / 100) * 0.6;
  const dfsMult     = t.dfsScanned ? 1.15 : 1.0;
  const dijkMult    = t.onDijkstraPath ? 1.10 : 1.0;
  const effAtk      = atkStrength * moraleMult * dfsMult * dijkMult * mod.atkMult;

  const terrainMult = TERRAIN_MULT[t.type] || 1.0;
  const effDef      = t.units * terrainMult;

  // ── DEDUCT UPFRONT GOLD COST ──
  const dijkDiscount = t.onDijkstraPath ? 0.75 : 1.0;
  const cg = Math.floor(t.cost * 50 * dijkDiscount) + goldExtra;
  res.gold -= cg;
  updateRes();

  // ── ANIMATE BATTLE BAR ──
  const anim = document.getElementById('btl-anim-fill');
  if (anim) {
    anim.classList.remove('running');
    void anim.offsetWidth;
    anim.classList.add('running');
  }

  setTimeout(() => {
    // ── DETERMINISTIC RESOLUTION ──
    let victory;

    // Talleyrand bloodless check (the ONLY random element)
    if (bloodless > 0 && Math.random() < bloodless) {
      victory = true;
      log(`Talleyrand's diplomacy — ${t.name} surrenders without battle!`, 'victory');
    } else {
      // DETERMINISTIC: bigger number wins
      victory = effAtk > effDef;
    }

    // ── SCALED LOSSES ──
    let armyLost, moraleChange;

    if (victory) {
      const closeness = effDef / Math.max(1, effAtk); // 0.0 (steamroll) to ~1.0 (barely won)
      const lossRate = 0.05 + closeness * 0.25;       // 5% to 30%
      armyLost = Math.floor(committed * lossRate);
      moraleChange = 5;
    } else {
      const closeness = effAtk / Math.max(1, effDef); // 0.0 (crushed) to ~1.0 (barely lost)
      const lossRate = (0.25 + (1 - closeness) * 0.25) * lossMultDef; // 25% to 50%, ×marshal
      armyLost = Math.floor(committed * lossRate);
      moraleChange = -(8 + Math.floor((1 - closeness) * 12)); // -8 to -20
    }

    // Apply army loss
    res.army -= armyLost;
    res.army = Math.max(0, res.army);
    res.morale = Math.max(0, Math.min(100, res.morale + moraleChange));

    if (victory) {
      handleVictory(t, armyLost);
    } else {
      handleDefeat(t, armyLost);
    }
  }, 1300);
}

// ── BATTLE STATE FOR CONQUEST MODAL ────────────────────────────
let lastConquestData = null;

function handleVictory(t, armyLost) {
  // Apply territory conquest
  res.gold += t.gold;
  t.owner   = 'player';
  t.status  = 'conquered';
  t.revealed = true;
  t.conqueredTurn = res.turn;

  // Scout adjacent territories
  t.neighbors.forEach(nid => {
    revealTerritory(nid);
    T[nid].bfsScanned = true;  // Victory auto-scouts neighbors
  });

  // Marshal glory boost
  if (battleState.marshalAbility) {
    Story.grantMarshalGlory(battleState.marshalAbility, 8);
  }

  // Roll for loot
  const loot    = rollLoot();
  const lootMsg = applyLoot(loot);

  // Show brief victory in battle modal
  document.getElementById('btl-result').textContent = `VICTORY! ${t.name} falls to the Grande Armée.`;
  document.getElementById('btl-result').className   = 'bresult bgood';

  const lootEl = document.getElementById('btl-loot');
  lootEl.textContent = `⚜ Spoils of War — ${lootMsg}`;
  lootEl.classList.add('show');

  // Narrative log
  const atmo = TERRITORY_ATMOSPHERE[t.name];
  log(atmo ? atmo.logVictory : `Victory! ${t.name} captured.`, 'victory');
  log(lootMsg, 'loot');

  // Store data for conquest result screen
  lastConquestData = { territory: t, lootMsg, loot, armyLost };

  autoSave();

  // Queue conquest modal via ScreenQueue (closes battle first)
  setTimeout(() => {
    ScreenQueue.next();  // Close the battle modal

    ScreenQueue.push('conquest',
      () => {
        updateRes();
        renderMap();
        showConquestModal(lastConquestData);
      },
      {
        hideFn: () => { document.getElementById('conquest-modal').style.display = 'none'; },
        cinematic: {
          type: 'victory',
          title: `${t.name} Falls`,
          subtitle: 'The Eagle advances.',
          kicker: 'Imperial Triumph',
        },
      }
    );
  }, 1400);
}

function handleDefeat(t, armyLost) {
  // Marshal consequence
  if (battleState.marshalAbility === 'ney') {
    Story.marshalLoyaltyHit('ney', -8);
  }

  // ── DEFEAT CONSEQUENCE 1: Enemy reinforcement ──
  t.units = Math.floor(t.units * 1.3);  // +30% garrison
  log(`${t.name} garrison reinforced to ${t.units.toLocaleString()}.`, 'defeat');

  // ── DEFEAT CONSEQUENCE 2: Attack cooldown ──
  attackCooldowns[t.id] = res.turn + 1;

  // ── DEFEAT CONSEQUENCE 3: Territory revolt ──
  const revoltChance = res.morale < 30 ? 0.50 : 0.25;
  const playerTerrs = T.filter(pt => pt.owner === 'player' && pt.id !== 0);
  let revoltMsg = '';

  if (playerTerrs.length > 0 && Math.random() < revoltChance) {
    const rebel = playerTerrs[Math.floor(Math.random() * playerTerrs.length)];
    rebel.owner = 'neutral';
    rebel.status = 'scouted';
    rebel.units = 1500 + Math.floor(Math.random() * 1500);
    rebel.conqueredTurn = 0;
    revoltMsg = rebel.name;
    log(`⚠ REVOLT! ${rebel.name} breaks from the Empire!`, 'defeat');
    toast(`${rebel.name} has revolted!`, 'danger');
  }

  // Show defeat in battle modal
  document.getElementById('btl-result').textContent = `DEFEAT! The offensive on ${t.name} was repelled.`;
  document.getElementById('btl-result').className   = 'bresult bbad';

  // Narrative log
  const atmo = TERRITORY_ATMOSPHERE[t.name];
  log(atmo ? atmo.logDefeat : `Defeat at ${t.name}.`, 'defeat');

  autoSave();

  // Queue defeat modal via ScreenQueue
  setTimeout(() => {
    ScreenQueue.next();  // Close battle modal

    ScreenQueue.push('defeat',
      () => {
        updateRes();
        renderMap();
        showDefeatModal(t, armyLost, revoltMsg);
      },
      {
        hideFn: () => { document.getElementById('defeat-modal').style.display = 'none'; },
        cinematic: {
          type: 'defeat',
          title: `${t.name} Holds`,
          subtitle: 'The offensive breaks on iron.',
          kicker: 'Field Report',
        },
      }
    );
  }, 1400);
}

// ── CONQUEST RESULT SCREEN ─────────────────────────────────────
function showConquestModal(data) {
  const { territory: t, lootMsg, loot } = data;
  const atmo = TERRITORY_ATMOSPHERE[t.name];
  const ch   = Story.getChapter();

  // Seal
  document.getElementById('cq-seal').textContent = atmo ? atmo.seal : '⚔';

  // Title
  document.getElementById('cq-title').textContent = atmo ? atmo.title : `${t.name.toUpperCase()} FALLS`;

  // Body prose
  const bodyEl = document.getElementById('cq-body');
  if (atmo) {
    bodyEl.innerHTML = atmo.conquest.replace(/\n/g, '<br><br>');
  } else {
    bodyEl.innerHTML = `<em>${t.name} falls to the Grande Armée.</em>`;
  }

  // Sensory detail
  const sensEl = document.getElementById('cq-sensory');
  sensEl.textContent = atmo ? atmo.sensory : '';
  sensEl.style.display = atmo ? 'block' : 'none';

  // Resource chips
  const resEl = document.getElementById('cq-resources');
  resEl.innerHTML = [
    `<div class="cq-res-chip negative">⚔ Army: -${data.armyLost.toLocaleString()}</div>`,
    `<div class="cq-res-chip positive">💰 Gold: +${data.territory.gold.toLocaleString()}</div>`,
    `<div class="cq-res-chip positive">🛡 Morale: +5%</div>`,
    data.territory.onDijkstraPath
      ? `<div class="cq-res-chip positive">📦 Supply Discount: -25% gold cost</div>` : '',
    data.territory.dfsScanned
      ? `<div class="cq-res-chip positive">🔍 Intel Bonus: +15% combat effectiveness</div>` : '',
  ].filter(Boolean).join('');

  // Loot
  const lootEl = document.getElementById('cq-loot');
  if (lootMsg) {
    lootEl.textContent = `⚜ Spoils of War — ${lootMsg}`;
    lootEl.classList.add('show');
  } else {
    lootEl.classList.remove('show');
  }

  // Marshal reaction (chapter-dependent)
  const marshalKeys = ['ney','berthier','murat','talleyrand','josephine'];
  const pick = battleState.marshalAbility || marshalKeys[Math.floor(Math.random() * marshalKeys.length)];
  const voice = MARSHAL_CONQUEST_VOICE[pick];
  const reaction = voice ? (voice[ch] || voice[1]) : '';

  const marshalEl = document.getElementById('cq-marshal');
  if (reaction) {
    const marshals = Story.getMarshals();
    const m = marshals[pick];
    marshalEl.innerHTML = `<div class="cq-marshal-name">${m ? m.emoji : '⚜'} ${m ? m.name : pick}</div>${reaction}`;
    marshalEl.style.display = 'block';
  } else {
    marshalEl.style.display = 'none';
  }

  document.getElementById('conquest-modal').style.display = 'flex';
}

function closeConquestModal() {
  ScreenQueue.next();  // This hides the conquest modal via hideFn & processes queue

  // Post-modal game flow:
  endTurn();
  if (selId !== null) {
    setNS(selId, 'selected');
    updateInfoPanel(selId);
    refreshConqBtn(selId);
  }
  checkWin();
  if (!checkGameOver()) {
    Story.check();
  }
}

// ── DEFEAT SCREEN ──────────────────────────────────────────────
function showDefeatModal(t, armyLost, revoltMsg) {
  const atmo = TERRITORY_ATMOSPHERE[t.name];

  document.getElementById('df-title').textContent = 'THE OFFENSIVE FAILS';

  const bodyEl = document.getElementById('df-body');
  if (atmo && atmo.defeat) {
    bodyEl.innerHTML = atmo.defeat;
  } else {
    bodyEl.innerHTML = `The offensive on ${t.name} stalls. The army retreats in order, but the silence in the ranks is its own kind of defeat.`;
  }

  // Resource losses
  document.getElementById('df-resources').innerHTML = [
    `<div class="cq-res-chip negative">⚔ Army: -${armyLost.toLocaleString()}</div>`,
    `<div class="cq-res-chip negative">🛡 Morale: -10%</div>`,
  ].join('');

  // Revolt warning
  if (revoltMsg) {
    const revEl = document.createElement('div');
    revEl.className = 'cq-res-chip negative';
    revEl.style.marginTop = '6px';
    revEl.textContent = `⚠ ${revoltMsg} has revolted!`;
    document.getElementById('df-resources').appendChild(revEl);
  }

  // Marshal consequence
  const dmEl = document.getElementById('df-marshal');
  if (battleState.marshalAbility === 'ney') {
    dmEl.innerHTML = 'Ney\'s charge was repulsed with heavy losses. He does not look at you when the reports come in.';
    dmEl.classList.add('show');
  } else if (battleState.marshalAbility === 'murat') {
    dmEl.innerHTML = 'Murat\'s cavalry breaks against the walls. His white velvet is stained with mud and worse.';
    dmEl.classList.add('show');
  } else {
    dmEl.classList.remove('show');
  }

  document.getElementById('defeat-modal').style.display = 'flex';
}

function closeDefeatModal() {
  ScreenQueue.next();

  endTurn();
  if (selId !== null) {
    setNS(selId, 'selected');
    updateInfoPanel(selId);
    refreshConqBtn(selId);
  }
  if (!checkGameOver()) {
    Story.check();
  }
}

// scheduleModalClose is no longer used — victory/defeat flows are
// handled directly by handleVictory and handleDefeat above.

// ── SETUP BATTLE MODAL STATIC EVENTS ───────────────────────────
// Called once from game.js on DOMContentLoaded
function initBattleModal() {
  document.getElementById('btl-retreat').onclick = () => {
    ScreenQueue.next();  // Instead of directly hiding
  };
  // btl-advance onclick is set dynamically per battle via initBattleAdvance(t)
}

// ── END TURN (auto-called after each battle) ────────────────────
// Turn advances automatically when the player closes the conquest
// or defeat result modal.  No manual button needed.
function endTurn() {
  res.turn++;
  recruitedThisTurn = false;  // Reset recruitment flag

  // ── TAX INCOME ──
  const playerCities = T.filter(t => t.owner === 'player').length;
  const tax = playerCities * 100;
  res.gold += tax;

  // ── GARRISON INCOME (troops from conquered territories) ──
  const garrisonRates = { city: 400, fort: 600, capital: 1000 };
  let totalRecruits = 0;
  const moraleMult = res.morale >= 80 ? 1.5 : res.morale >= 50 ? 1.0 : res.morale >= 30 ? 0.7 : 0;

  T.filter(t => t.owner === 'player').forEach(t => {
    const base = garrisonRates[t.type] || 400;
    totalRecruits += Math.floor(base * moraleMult);
  });
  res.army += totalRecruits;

  // ── ESCALATING ENEMY REINFORCEMENT ──
  let reinforce;
  if      (res.turn <= 5)  reinforce = 200;
  else if (res.turn <= 10) reinforce = 500;
  else if (res.turn <= 15) reinforce = 1000;
  else                     reinforce = 2000;

  T.filter(t => t.owner === 'enemy').forEach(t => { t.units += reinforce; });

  // ── ENEMY COUNTERATTACK (every 3 turns after turn 10) ──
  if (res.turn >= 10 && res.turn % 3 === 0) {
    const playerTerrs = T.filter(t => t.owner === 'player' && t.id !== 0);
    const enemyTerrs  = T.filter(t => t.owner === 'enemy');

    if (playerTerrs.length > 0 && enemyTerrs.length > 0) {
      const attacker = enemyTerrs.reduce((a, b) => a.units > b.units ? a : b);
      const target   = playerTerrs.reduce((a, b) => {
        const aGarr = 500 + (res.turn - (a.conqueredTurn || 0)) * 100;
        const bGarr = 500 + (res.turn - (b.conqueredTurn || 0)) * 100;
        return aGarr < bGarr ? a : b;
      });

      const playerGarrison = 500 + (res.turn - (target.conqueredTurn || 0)) * 100;

      if (attacker.units > playerGarrison) {
        target.owner  = 'neutral';
        target.status = 'scouted';
        target.units  = Math.floor(attacker.units * 0.4);
        target.conqueredTurn = 0;
        log(`⚠ ${attacker.name} counterattacks! ${target.name} falls!`, 'defeat');
        toast(`${target.name} lost to counterattack!`, 'danger');
      }
    }
  }

  // ── MORALE BLEED WHEN EMPIRE IS SHRINKING ──
  const currentCount = T.filter(t => t.owner === 'player').length;
  peakTerritories = Math.max(peakTerritories, currentCount);

  if (currentCount < peakTerritories && res.turn > 3) {
    const bleed = (peakTerritories - currentCount) * 3;
    res.morale = Math.max(0, res.morale - bleed);
    log(`Empire shrinking — morale bleeds -${bleed}%`, 'defeat');
  }

  // ── LOG ──
  log(`Turn ${res.turn} — Tax: +${tax}g · Recruits: +${totalRecruits.toLocaleString()} · Enemy +${reinforce}/territory`, 'info');
  toast(`Turn ${res.turn} · Tax +${tax}g · +${totalRecruits.toLocaleString()} recruits`);

  updateRes();
  if (selId !== null) selectT(selId);
  autoSave();
}

// ── WIN CHECK — THE LAST PAGE ───────────────────────────────────
function checkWin() {
  if (!T.every(t => t.owner === 'player')) return;

  // Wrap the entire win display in ScreenQueue
  ScreenQueue.push('win',
    () => {
      const ending = Story.getPersonalisedEnding();

      // Opening narrative
      document.getElementById('win-narrative').innerHTML =
        `<p>${ending.openingParagraph}</p>`;

      // Marshal beats
      const beatsEl = document.getElementById('win-marshals');
      beatsEl.innerHTML = '';
      ending.marshalBeats.forEach(beat => {
        const st = beat.status;
        const card = document.createElement('div');
        card.className = 'win-marshal-beat';
        card.innerHTML = `
          <div class="wmb-avatar">${beat.emoji}</div>
          <div class="wmb-content">
            <div class="wmb-header">
              <span class="wmb-name">${beat.name}</span>
              <span class="wmb-status m-status ${st.cls}">${st.label}</span>
            </div>
            <div class="wmb-prose">${beat.prose}</div>
          </div>`;
        beatsEl.appendChild(card);
      });

      // Stats bar
      document.getElementById('win-stats-bar').innerHTML =
        `Territories: ${T.length}/${T.length} · Turns: ${res.turn} · Army: ${res.army.toLocaleString()} · Gold: ${res.gold.toLocaleString()} · Morale: ${res.morale}%`;

      // Final line
      const path = Story.getPath();
      if (path.includes('map_is_paper')) {
        document.getElementById('win-final-line').innerHTML =
          '"The map is just paper, Berthier. The laugh is the only thing that was ever real."';
      } else if (path.includes('sent_final_letter')) {
        document.getElementById('win-final-line').innerHTML =
          '"The courier rides. Not for the Senate. Not for the palace. To the house in the Rue de la Victoire. To the roses. To the laugh."';
      } else {
        document.getElementById('win-final-line').innerHTML =
          '"The map is just paper, Berthier. The laugh is the only thing that was ever real."';
      }

      document.getElementById('win-modal').style.display = 'flex';
    },
    {
      hideFn: () => { document.getElementById('win-modal').style.display = 'none'; },
      cinematic: {
        type: 'victory',
        title: 'THE EMPIRE IS COMPLETE',
        subtitle: 'All of Europe bows to the Eagle.',
        kicker: 'Final Victory',
      },
    }
  );
}

function checkGameOver() {
  let reason = null;
  let prose  = '';

  if (res.army <= 0) {
    reason = 'army';
    prose = 'The last dispatch rider reaches Paris at dawn. The Grande Armée exists only in the dispatches of men who are already dead. The Eagles are captured. The drums are silent.';
  } else if (res.morale <= 0) {
    reason = 'morale';
    prose = 'The drums fall silent. The muskets are turned. The soldiers who once marched for the Emperor now march against him. The army mutinies. The dream of empire dies not on a battlefield, but in the cold silence of men who have stopped believing.';
  } else if (T.filter(t => t.owner === 'player').length <= 1 && res.turn > 3) {
    reason = 'territory';
    prose = 'The map is empty again. The ink has faded. The borders you drew with blood and ambition have been erased by the coalition. Only Paris remains — and Paris watches with the quiet, calculating eyes of a city that has survived every Emperor.';
  }

  if (!reason) return false;

  // Show game over screen
  ScreenQueue.clear();

  ScreenQueue.push('gameover',
    () => {
      document.getElementById('go-body').innerHTML = `<p>${prose}</p>`;
      document.getElementById('go-stats').innerHTML = [
        `<div class="cq-res-chip negative">Turns Survived: ${res.turn}</div>`,
        `<div class="cq-res-chip negative">Peak Territories: ${peakTerritories}/15</div>`,
        `<div class="cq-res-chip negative">Final Army: ${res.army.toLocaleString()}</div>`,
        `<div class="cq-res-chip negative">Final Morale: ${res.morale}%</div>`,
      ].join('');
      document.getElementById('gameover-modal').style.display = 'flex';
    },
    {
      hideFn: () => { document.getElementById('gameover-modal').style.display = 'none'; },
      cinematic: {
        type: 'defeat',
        title: 'THE CAMPAIGN IS LOST',
        subtitle: reason === 'army' ? 'The army is destroyed.'
                : reason === 'morale' ? 'The army mutinies.'
                : 'The empire crumbles.',
        kicker: 'Final Dispatch',
      },
    }
  );

  return true;
}

function recruitTroops() {
  if (recruitedThisTurn) {
    toast('Already recruited this turn. Wait for next turn.');
    return;
  }
  if (res.morale < 20) {
    toast('Morale too low — army is deserting, not enlisting.');
    return;
  }

  const maxSpend = 375;  // Cap: 375g = 3,000 troops max
  const goldAvailable = Math.min(res.gold, maxSpend);

  if (goldAvailable < 100) {
    toast('Need at least 100g to recruit (minimum 800 troops).');
    return;
  }

  const troops = goldAvailable * 8;  // 1 gold = 8 troops
  res.gold -= goldAvailable;
  res.army += troops;
  recruitedThisTurn = true;

  log(`Recruited ${troops.toLocaleString()} troops for ${goldAvailable}g.`, 'info');
  toast(`+${troops.toLocaleString()} troops recruited`);
  updateRes();
}

// ── RESET ───────────────────────────────────────────────────────
function resetGame() {
  resetGameData();
  ScreenQueue.clear();
  Object.keys(attackCooldowns).forEach(k => delete attackCooldowns[k]);
  recruitedThisTurn = false;
  peakTerritories = 1;
  greedyUsedThisChapter = false;
  firstBfsDone = false;
  localStorage.removeItem('cc_first_bfs_done');
  document.getElementById('step-list').innerHTML = '';
  document.getElementById('tinfo').innerHTML =
    '<div style="color:var(--fog);font-size:.68rem;font-style:italic;">Click a territory to inspect it.</div>';
  document.getElementById('conq-btn').disabled = true;
  document.getElementById('conq-btn').textContent = '⚔ Conquer Territory';
  updateRes();
  renderMap();
  log('Campaign reset. The Emperor returns to Paris.', 'info');
  Story.reset();
  // Tell backend to reset its state, then sync frontend's clean state
  apiGet('/reset').then(() => syncBackend());
}

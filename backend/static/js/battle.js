/* ══════════════════════════════════════════════════════════════
   battle.js  ·  Crown & Conquest — DAA-IV-T241
   Battle system: probability display, army commitment,
   marshal abilities, animated battle bar, loot rolls.
══════════════════════════════════════════════════════════════ */

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

  playEventCinematic('battle', `Battle for ${t.name}`, 'Steel meets destiny.', 'War Council');

  document.getElementById('battle-modal').style.display = 'flex';
}

// ── BATTLE ODDS DISPLAY ─────────────────────────────────────────
function updateBattleOddsDisplay(t) {
  const atkStrength = Math.max(1, Math.floor(res.army * battleState.commitFraction * 0.6));
  const moraleMult  = 0.7 + (res.morale / 100) * 0.6;
  let effAtk = atkStrength * moraleMult;

  // Apply marshal ability modifier
  const abilityMod = getMarshalModifier(t);
  effAtk *= abilityMod.atkMult;

  const winPct = Math.min(98, Math.max(2, Math.round(effAtk / (effAtk + t.units) * 100)));
  const barColor = winPct >= 60 ? '#7ab870' : winPct >= 40 ? '#e9c176' : '#f87171';

  document.getElementById('btl-atk').textContent = Math.floor(effAtk).toLocaleString();
  document.getElementById('btl-def').textContent = t.units.toLocaleString();

  const fill = document.getElementById('odds-fill');
  fill.style.width      = winPct + '%';
  fill.style.background = barColor;

  document.getElementById('odds-win').textContent  = winPct + '%';
  document.getElementById('odds-lose').textContent = (100 - winPct) + '%';

  // Colour the win side
  document.getElementById('odds-win').style.color  = barColor;
  document.getElementById('odds-lose').style.color = '#f87171';
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
  const advBtn  = document.getElementById('btl-advance');
  advBtn.disabled = true;

  const mod         = getMarshalModifier(t);
  const goldExtra   = mod.goldCostExtra || 0;
  const lossMultDef = mod.lossMultOnDefeat || 1.0;
  const bloodless   = mod.bloodlessChance || 0;

  // Compute current win probability fresh (same formula as display)
  const atkStrength = Math.max(1, Math.floor(res.army * battleState.commitFraction * 0.6));
  const moraleMult  = 0.7 + (res.morale / 100) * 0.6;
  const effAtk      = atkStrength * moraleMult * mod.atkMult;
  const winPct      = Math.min(98, Math.max(2, Math.round(effAtk / (effAtk + t.units) * 100)));

  // Deduct resource costs before the dice roll
  const cg = t.cost * 50 + goldExtra;
  const ca = Math.floor(res.army * battleState.commitFraction * 0.15);
  res.gold  -= cg;
  res.army  -= ca;
  updateRes();

  // Reset and trigger battle bar animation — remove/re-add class forces restart
  const anim = document.getElementById('btl-anim-fill');
  if (anim) {
    anim.classList.remove('running');
    void anim.offsetWidth; // force reflow so animation restarts
    anim.classList.add('running');
  }

  setTimeout(() => {
    // Bloodless check (Talleyrand)
    let victory;
    if (bloodless > 0 && Math.random() < bloodless) {
      victory = true;
      log(`Talleyrand's diplomacy — ${t.name} surrenders without battle!`, 'victory');
    } else {
      victory = Math.random() < (winPct / 100);
    }

    if (victory) {
      handleVictory(t, ca, lossMultDef);
    } else {
      handleDefeat(t, ca, lossMultDef);
    }
  }, 1300);
}

// ── BATTLE STATE FOR CONQUEST MODAL ────────────────────────────
let lastConquestData = null;

function handleVictory(t, armyCostPaid, _lossMultDef) {
  // Partial army refund on victory
  const armyRefund = Math.floor(armyCostPaid * 0.6);
  res.army  += armyRefund;
  res.morale = Math.min(100, res.morale + 5);
  res.gold  += t.gold;

  t.owner   = 'player';
  t.status  = 'conquered';
  t.revealed = true;

  // Scout adjacent territories
  t.neighbors.forEach(nid => revealTerritory(nid));

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
  if (atmo) {
    log(atmo.logVictory, 'victory');
  } else {
    log(`Victory! ${t.name} captured.`, 'victory');
  }
  log(lootMsg, 'loot');
  playEventCinematic('victory', `${t.name} Falls`, 'The Eagle advances.', 'Imperial Triumph');

  // Store data for conquest result screen
  lastConquestData = { territory: t, lootMsg, loot, armyCostPaid, armyRefund };

  autoSave();

  // Close battle modal → open conquest result screen
  setTimeout(() => {
    document.getElementById('battle-modal').style.display = 'none';
    updateRes();
    renderMap();
    showConquestModal(lastConquestData);
  }, 1400);
}

function handleDefeat(t, armyCostPaid, lossMultOnDefeat) {
  const extraLoss = Math.floor(armyCostPaid * (lossMultOnDefeat - 1));
  res.army  -= extraLoss;
  res.army   = Math.max(0, res.army);
  res.morale = Math.max(0, res.morale - 10);

  // Defender is weakened even in victory
  t.units = Math.floor(t.units * 0.82);

  document.getElementById('btl-result').textContent = `DEFEAT! The offensive on ${t.name} was repelled.`;
  document.getElementById('btl-result').className   = 'bresult bbad';

  // Story consequence for defeat
  if (battleState.marshalAbility === 'ney') {
    Story.marshalLoyaltyHit('ney', -8);
  }

  // Narrative log
  const atmo = TERRITORY_ATMOSPHERE[t.name];
  if (atmo) {
    log(atmo.logDefeat, 'defeat');
  } else {
    log(`Defeat at ${t.name}. Army: ${res.army.toLocaleString()}, Morale: ${res.morale}%`, 'defeat');
  }
  playEventCinematic('defeat', `${t.name} Holds`, 'The offensive breaks on iron.', 'Field Report');

  autoSave();

  // Close battle modal → show defeat screen
  setTimeout(() => {
    document.getElementById('battle-modal').style.display = 'none';
    updateRes();
    renderMap();
    showDefeatModal(t, armyCostPaid, extraLoss);
  }, 1400);
}

// ── CONQUEST RESULT SCREEN ─────────────────────────────────────
function showConquestModal(data) {
  const { territory: t, lootMsg, loot, armyCostPaid, armyRefund } = data;
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
  const netArmy = armyRefund - armyCostPaid;
  resEl.innerHTML = [
    `<div class="cq-res-chip ${netArmy >= 0 ? 'positive' : 'negative'}">⚔ Army: ${netArmy >= 0 ? '+' : ''}${netArmy.toLocaleString()}</div>`,
    `<div class="cq-res-chip positive">💰 Gold: +${t.gold.toLocaleString()}</div>`,
    `<div class="cq-res-chip positive">🛡 Morale: +5%</div>`,
  ].join('');

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
  document.getElementById('conquest-modal').style.display = 'none';
  // Auto-advance turn after each conquest
  endTurn();
  if (selId !== null) {
    setNS(selId, 'selected');
    updateInfoPanel(selId);
    refreshConqBtn(selId);
  }
  checkWin();
  Story.check();
}

// ── DEFEAT SCREEN ──────────────────────────────────────────────
function showDefeatModal(t, armyCostPaid, extraLoss) {
  const atmo = TERRITORY_ATMOSPHERE[t.name];

  document.getElementById('df-title').textContent = 'THE OFFENSIVE FAILS';

  const bodyEl = document.getElementById('df-body');
  if (atmo && atmo.defeat) {
    bodyEl.innerHTML = atmo.defeat;
  } else {
    bodyEl.innerHTML = `The offensive on ${t.name} stalls. The army retreats in order, but the silence in the ranks is its own kind of defeat.`;
  }

  // Resource losses
  const totalLoss = armyCostPaid + extraLoss;
  document.getElementById('df-resources').innerHTML = [
    `<div class="cq-res-chip negative">⚔ Army: -${totalLoss.toLocaleString()}</div>`,
    `<div class="cq-res-chip negative">🛡 Morale: -10%</div>`,
  ].join('');

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
  document.getElementById('defeat-modal').style.display = 'none';
  // Auto-advance turn after each battle (even defeats)
  endTurn();
  if (selId !== null) {
    setNS(selId, 'selected');
    updateInfoPanel(selId);
    refreshConqBtn(selId);
  }
  Story.check();
}

// scheduleModalClose is no longer used — victory/defeat flows are
// handled directly by handleVictory and handleDefeat above.

// ── SETUP BATTLE MODAL STATIC EVENTS ───────────────────────────
// Called once from game.js on DOMContentLoaded
function initBattleModal() {
  document.getElementById('btl-retreat').onclick = () => {
    document.getElementById('battle-modal').style.display = 'none';
  };
  // btl-advance onclick is set dynamically per battle via initBattleAdvance(t)
}

// ── END TURN (auto-called after each battle) ────────────────────
// Turn advances automatically when the player closes the conquest
// or defeat result modal.  No manual button needed.
function endTurn() {
  res.turn++;
  const playerCities = T.filter(t => t.owner === 'player').length;
  const tax          = playerCities * 100;
  res.gold  += tax;
  // Enemies grow stronger each turn
  T.filter(t => t.owner === 'enemy').forEach(t => { t.units += 250; });

  log(`Turn ${res.turn} — Tax: +${tax}g. Enemy forces reinforce.`, 'info');
  toast(`Turn ${res.turn} · Tax +${tax}g · Enemies reinforce`);
  playEventCinematic('intel', `Turn ${res.turn}`, `Tax +${tax}g · Enemy forces reinforce.`, 'Campaign Ledger');

  updateRes();
  if (selId !== null) selectT(selId);

  autoSave();
}

// ── WIN CHECK — THE LAST PAGE ───────────────────────────────────
function checkWin() {
  if (!T.every(t => t.owner === 'player')) return;

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
}

// ── RESET ───────────────────────────────────────────────────────
function resetGame() {
  resetGameData();
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

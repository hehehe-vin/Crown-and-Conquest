/* ══════════════════════════════════════════════════════════════
   render.js  ·  Crown & Conquest — DAA-IV-T241
   SVG map rendering, node/edge helpers, tooltip, UI updates
══════════════════════════════════════════════════════════════ */

// ── SVG HELPER ─────────────────────────────────────────────────
function svgEl(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

// ── FULL MAP RENDER ─────────────────────────────────────────────
function renderMap() {
  const EL = document.getElementById('edge-layer');
  const NL = document.getElementById('node-layer');
  EL.innerHTML = '';
  NL.innerHTML = '';

  // Draw edges
  const drawn = new Set();
  EDGES.forEach(([a, b, w]) => {
    const key = `${Math.min(a,b)}-${Math.max(a,b)}`;
    if (drawn.has(key)) return;
    drawn.add(key);
    const ta = T[a], tb = T[b];
    const line = svgEl('line', {
      x1: ta.x, y1: ta.y, x2: tb.x, y2: tb.y,
      stroke: '#ffffff', class: 'edge', 'data-edge': key,
    });
    EL.appendChild(line);

    // Edge weight label
    const mx = (ta.x + tb.x) / 2;
    const my = (ta.y + tb.y) / 2;
    const wt = svgEl('text', { x: mx, y: my - 4, class: 'ewt', 'data-wt': key });
    wt.textContent = w;
    EL.appendChild(wt);
  });

  // Draw nodes
  T.forEach(t => {
    const effectiveState = getEffectiveState(t);
    const g = svgEl('g', {
      id: `n${t.id}`,
      'data-state': effectiveState,
      transform: `translate(${t.x},${t.y})`,
    });

    const r = t.type === 'capital' ? 13 : t.type === 'fort' ? 10 : 9;
    const c = svgEl('circle', { class: 'ncirc', cx: 0, cy: 0, r });
    if (t.id === 0 && t.status === 'conquered') c.classList.add('pulse-anim');

    // Icon — hidden for truly fogged nodes
    const ic = svgEl('text', {
      x: 0, y: 1,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      'pointer-events': 'none',
      'font-size': t.type === 'capital' ? '11' : '9',
      fill: '#fff',
      opacity: t.revealed ? '.85' : '.2',
    });
    ic.textContent = t.type === 'capital' ? '♚' : t.type === 'fort' ? '⚔' : '⚑';

    // Label
    const lb = svgEl('text', {
      class: t.revealed ? 'nlabel' : 'nlabel-fog',
      x: 0,
      y: r + 12,
    });
    lb.textContent = t.revealed ? t.name : '???';

    g.appendChild(c);
    g.appendChild(ic);
    g.appendChild(lb);

    g.addEventListener('click', () => selectT(t.id));
    g.addEventListener('mouseenter', e => showTip(t, e));
    g.addEventListener('mouseleave', hideTip);
    NL.appendChild(g);
  });
}

/** Determine the visual state for a territory, considering fog */
function getEffectiveState(t) {
  if (!t.revealed && t.status !== 'conquered') return 'fog';
  return t.status;
}

// ── NODE STATE HELPERS ──────────────────────────────────────────
function setNS(id, state) {
  const g = document.getElementById(`n${id}`);
  if (g) g.setAttribute('data-state', state);
}

function setEdgeCls(a, b, cls) {
  const key = `${Math.min(a,b)}-${Math.max(a,b)}`;
  const line = document.querySelector(`[data-edge="${key}"]`);
  if (!line) return;
  const colorMap = {
    'active-path': '#e9c176',
    'traversed':   '#7ab870',
    'frontier':    '#8ab4e0',
  };
  line.setAttribute('stroke', colorMap[cls] || '#ffffff');
  line.className.baseVal = `edge ${cls}`;
}

// ── NODE ANIMATION HELPERS ──────────────────────────────────────
function flashNode(id, cssClass, durationMs) {
  const g = document.getElementById(`n${id}`);
  if (!g) return;
  g.classList.add(cssClass);
  setTimeout(() => g.classList.remove(cssClass), durationMs);
}

// ── RESOURCE HUD UPDATE ─────────────────────────────────────────
function updateRes() {
  document.getElementById('r-army').textContent   = res.army.toLocaleString();
  document.getElementById('r-gold').textContent   = res.gold.toLocaleString();
  document.getElementById('r-morale').textContent = res.morale + '%';
  document.getElementById('r-turn').textContent   = res.turn;

  // Morale bar in topbar
  const mb = document.getElementById('morale-fill');
  if (mb) mb.style.width = res.morale + '%';

  // HUD territory counter + progress
  const owned = T.filter(t => t.owner === 'player').length;
  document.getElementById('hud-terr').textContent = `${owned}/15`;
  document.getElementById('hud-prog').style.width = `${(owned / 15) * 100}%`;

  // Colour morale bar by level
  if (mb) {
    if (res.morale >= 70)      mb.style.background = 'linear-gradient(90deg,#1a3a1a,#7ab870)';
    else if (res.morale >= 40) mb.style.background = 'linear-gradient(90deg,#3a2a00,#e9c176)';
    else                       mb.style.background = 'linear-gradient(90deg,#5c1010,#f87171)';
  }
}

// ── TERRITORY INFO PANEL ────────────────────────────────────────
function updateInfoPanel(id) {
  const t = T[id];
  const ownedLabel = t.owner === 'player' ? 'Imperial' : t.owner === 'enemy' ? 'Enemy' : 'Neutral';
  const ttype = t.type.charAt(0).toUpperCase() + t.type.slice(1);
  const icon  = t.type === 'capital' ? '♚ ' : t.type === 'fort' ? '⚔ ' : '⚑ ';

  // Fog of war — hide stats for unrevealed territories
  const fog = !t.revealed;
  const hiddenVal = (v) => fog ? `<span class="tval fog-hidden">— — —</span>` : `<span class="tval">${v}</span>`;
  const hiddenCost = (t) => {
    if (fog) return `<span class="tval fog-hidden">— — —</span>`;
    if (t.cost === 0) return `<span class="tval">Capital</span>`;
    return `<span class="tval">${t.cost*50}g / ${(t.cost*500).toLocaleString()} troops</span>`;
  };

  // Win chance preview (only if reachable, revealed, and not already owned)
  let winChanceHtml = '';
  const isReachable = getReachable().includes(id) && t.owner !== 'player';
  if (isReachable && t.revealed) {
    const atkStrength = Math.max(1, Math.floor(res.army * battleState.commitFraction * 0.6));
    const moraleMult  = 0.7 + (res.morale / 100) * 0.6;
    const effAtk      = atkStrength * moraleMult;
    const winPct      = Math.min(98, Math.max(2, Math.round(effAtk / (effAtk + t.units) * 100)));
    const barColor    = winPct >= 60 ? '#7ab870' : winPct >= 40 ? '#e9c176' : '#f87171';
    winChanceHtml = `
      <div class="trow" style="margin-top:5px;">
        <span class="tkey">Est. Win Chance</span>
        <span class="tval" style="color:${barColor}">${winPct}%</span>
      </div>
      <div class="win-chance-bar">
        <div class="win-chance-fill" style="width:${winPct}%;background:${barColor}"></div>
      </div>`;
  }

  document.getElementById('tinfo').innerHTML = `
    <div class="tcard">
      <div class="tname">${icon}${fog ? '???' : t.name}</div>
      <div class="trow"><span class="tkey">Type</span>${fog ? hiddenVal('') : `<span class="tval">${ttype}</span>`}</div>
      <div class="trow"><span class="tkey">Control</span><span class="tval">${ownedLabel}</span></div>
      <div class="trow"><span class="tkey">Garrison</span>${hiddenVal(t.units.toLocaleString())}</div>
      <div class="trow"><span class="tkey">Gold Reward</span>${hiddenVal(t.gold > 0 ? t.gold + 'g' : '—')}</div>
      <div class="trow"><span class="tkey">Inv. Cost</span>${hiddenCost(t)}</div>
      ${winChanceHtml}
    </div>`;
}

// ── TOOLTIP ─────────────────────────────────────────────────────
function showTip(t, e) {
  const fog = !t.revealed;
  document.getElementById('tip-name').textContent = fog ? '???' : t.name;
  document.getElementById('tip-row1').textContent = fog
    ? 'Uncharted territory'
    : `Garrison: ${t.units.toLocaleString()} · Gold: ${t.gold}g`;
  document.getElementById('tip-row2').textContent = fog
    ? 'Scout to reveal'
    : `${t.owner.charAt(0).toUpperCase()+t.owner.slice(1)} · ${t.type}`;

  const tip = document.getElementById('maptip');
  tip.style.left    = (e.clientX + 14) + 'px';
  tip.style.top     = (e.clientY - 10) + 'px';
  tip.style.opacity = '1';
}

function hideTip() {
  document.getElementById('maptip').style.opacity = '0';
}

// ── LOG & STEP HELPERS ──────────────────────────────────────────
function log(msg, type = 'info') {
  const lb = document.getElementById('log-body');
  const d  = document.createElement('div');
  d.className = `lentry ${type}`;
  const time = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  d.innerHTML = `<span class="ltime">${time}</span>${msg}`;
  lb.prepend(d);
  while (lb.children.length > 55) lb.removeChild(lb.lastChild);
}

function addStep(txt, cls = '') {
  const sl = document.getElementById('step-list');
  const d  = document.createElement('div');
  d.className = `step ${cls}`;
  d.textContent = txt;
  sl.prepend(d);
  while (sl.children.length > 32) sl.removeChild(sl.lastChild);
}

function markVis() {
  const sl = document.getElementById('step-list');
  if (sl.firstChild) sl.firstChild.className = 'step vis';
}

// ── TOAST ───────────────────────────────────────────────────────
let _toastTimer;
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = type ? `show ${type}` : 'show';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.className = ''; }, 2400);
}

// ── CONQUER BUTTON STATE ────────────────────────────────────────
function refreshConqBtn(id) {
  const t   = T[id];
  const btn = document.getElementById('conq-btn');
  const reachable = getReachable();

  const canAttack = reachable.includes(id) && t.owner !== 'player';
  const goldOk    = res.gold >= t.cost * 50;
  const armyOk    = res.army >= 500; // minimum meaningful force

  btn.disabled = !canAttack;

  if (!canAttack) {
    btn.textContent = '⚔ Conquer Territory';
    return;
  }
  if (!t.revealed) {
    btn.textContent = '🔍 Scout First';
    btn.disabled = true;
    return;
  }
  if (!goldOk) {
    btn.textContent = `✗ Need ${t.cost * 50}g`;
    btn.disabled = true;
    return;
  }
  if (!armyOk) {
    btn.textContent = '✗ Army Depleted';
    btn.disabled = true;
    return;
  }
  btn.textContent = t.owner === 'enemy' ? '⚔ Battle!' : '⚔ Conquer Territory';
}

// ── SLEEP UTILITY ───────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

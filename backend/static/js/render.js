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

// ── MAP VIEWPORT INTERACTION (PAN + ZOOM) ─────────────────────
const mapView = {
  baseX: 0,
  baseY: 0,
  baseW: 1000,
  baseH: 800,
  x: 0,
  y: 0,
  w: 1000,
  h: 800,
  minW: 340,
  maxW: 1000,
  dragging: false,
  lastX: 0,
  lastY: 0,
};

const OVERLAY_MODES = ['off', 'ownership', 'threat', 'wealth', 'reachable', 'routes'];
let overlayModeIdx = 0;
let contrastBoost = false;
const uiScaleSteps = [100, 110, 120, 130];
let uiScaleIdx = 0;
const motionModes = ['low', 'medium', 'high'];
let motionMode = 'medium';
let cinematicTimer = null;

function playEventCinematic(type, title, subtitle = '', kicker = 'Imperial Dispatch') {
  const el = document.getElementById('cinematic-event');
  if (!el) return;

  const cls = ['cinematic-victory', 'cinematic-defeat', 'cinematic-battle',
               'cinematic-intel', 'cinematic-chapter', 'cinematic-story'];
  el.classList.remove(...cls, 'active');

  document.getElementById('cine-kicker').textContent = kicker;
  document.getElementById('cine-title').textContent  = title;
  document.getElementById('cine-sub').textContent    = subtitle || 'The campaign shifts.';

  const map = {
    victory: 'cinematic-victory',
    defeat:  'cinematic-defeat',
    battle:  'cinematic-battle',
    intel:   'cinematic-intel',
    chapter: 'cinematic-chapter',
    story:   'cinematic-story',
  };
  el.classList.add(map[type] || 'cinematic-intel');

  void el.offsetWidth;
  el.classList.add('active');

  const dur = motionMode === 'high' ? 2200 : motionMode === 'low' ? 1100 : 1800;

  clearTimeout(cinematicTimer);
  cinematicTimer = setTimeout(() => {
    el.classList.remove('active');
  }, dur);
}

/**
 * Promise wrapper — resolves when cinematic animation ends.
 * Used by ScreenQueue to await cinematic completion before showing a modal.
 */
function playCinematicPromise(type, title, subtitle, kicker) {
  return new Promise(resolve => {
    playEventCinematic(type, title, subtitle, kicker);
    const dur = motionMode === 'high' ? 2400 : motionMode === 'low' ? 1300 : 2000;
    setTimeout(resolve, dur);
  });
}

function getOverlayMode() {
  return OVERLAY_MODES[overlayModeIdx];
}

function cycleOverlayMode() {
  overlayModeIdx = (overlayModeIdx + 1) % OVERLAY_MODES.length;
  applyOverlayMode();
  localStorage.setItem('cc_overlay_mode', String(overlayModeIdx));
}

function setOverlayMode(mode) {
  const idx = OVERLAY_MODES.indexOf(mode);
  if (idx >= 0) {
    overlayModeIdx = idx;
    applyOverlayMode();
  }
}

function applyOverlayMode() {
  const area = document.getElementById('map-area');
  if (!area) return;

  T.forEach(t => {
    const region = document.getElementById(`r${t.id}`);
    if (!region) return;
    region.style.fill = '';
    region.style.stroke = '';
    region.style.strokeWidth = '';
    region.removeAttribute('data-reachable');
  });

  // Remove all overlay classes
  OVERLAY_MODES.forEach(m => area.classList.remove(`overlay-${m}`));
  // Add current
  const mode = OVERLAY_MODES[overlayModeIdx];
  area.classList.add(`overlay-${mode}`);

  // Apply dynamic styles for threat/wealth modes
  if (mode === 'threat' || mode === 'wealth') {
    applyHeatMapOverlay(mode);
  }
  if (mode === 'reachable') {
    applyReachableOverlay();
  }
  if (mode === 'routes') {
    applyRoutesOverlay();
  }

  // Update settings popup value text
  const btn = document.getElementById('overlay-toggle-btn');
  if (btn) {
    const valueEl = btn.querySelector('.settings-value');
    if (valueEl) {
      const labels = { off:'Off', ownership:'Ownership', threat:'Threat',
                       wealth:'Wealth', reachable:'Reachable', routes:'Routes' };
      valueEl.textContent = labels[mode] || mode;
    }
  }
}

function applyHeatMapOverlay(mode) {
  // Compute max value for normalization
  const enemies = T.filter(t => t.owner !== 'player');
  if (!enemies.length) return;

  const maxVal = mode === 'threat'
    ? Math.max(...enemies.map(t => t.units))
    : Math.max(...enemies.map(t => t.gold));

  T.forEach(t => {
    const region = document.getElementById(`r${t.id}`);
    if (!region) return;

    if (t.owner === 'player') {
      region.style.fill = 'rgba(122,184,112,.15)';
      region.style.stroke = 'rgba(122,184,112,.25)';
      return;
    }

    const val = mode === 'threat' ? t.units : t.gold;
    const intensity = maxVal > 0 ? (val / maxVal) : 0;

    if (mode === 'threat') {
      region.style.fill = `rgba(248,113,113,${0.1 + intensity * 0.45})`;
      region.style.stroke = `rgba(248,113,113,${0.15 + intensity * 0.35})`;
    } else {
      region.style.fill = `rgba(233,193,118,${0.1 + intensity * 0.45})`;
      region.style.stroke = `rgba(233,193,118,${0.15 + intensity * 0.35})`;
    }
  });
}

function applyReachableOverlay() {
  const reachable = getReachable();
  T.forEach(t => {
    const region = document.getElementById(`r${t.id}`);
    if (!region) return;

    if (reachable.includes(t.id) && t.owner !== 'player') {
      region.style.fill = 'rgba(138,180,224,.22)';
      region.style.stroke = 'rgba(138,180,224,.7)';
      region.style.strokeWidth = '2.5';
      region.setAttribute('data-reachable', 'true');
    } else if (t.owner === 'player') {
      region.style.fill = 'rgba(122,184,112,.12)';
    }
  });
}

function applyRoutesOverlay() {
  if (!lastComputedPaths || !lastComputedPaths.prev) return;
  const prev = lastComputedPaths.prev;
  Object.keys(prev).forEach(nodeId => {
    const id = Number(nodeId);
    if (prev[id] !== undefined && prev[id] !== null) {
      setEdgeCls(prev[id], id, 'active-path');
    }
  });
}

function applyContrastMode() {
  document.body.classList.toggle('contrast-boost', contrastBoost);
  const btn = document.getElementById('contrast-toggle-btn');
  if (btn) {
    const valueEl = btn.querySelector('.settings-value');
    if (valueEl) valueEl.textContent = contrastBoost ? 'On' : 'Off';
  }
}

function toggleContrastMode() {
  contrastBoost = !contrastBoost;
  applyContrastMode();
  localStorage.setItem('cc_contrast_boost', contrastBoost ? '1' : '0');
}

function applyUiScale() {
  const pct = uiScaleSteps[uiScaleIdx] || 100;
  document.documentElement.style.fontSize = `${pct}%`;
  const btn = document.getElementById('ui-scale-btn');
  if (btn) {
    const valueEl = btn.querySelector('.settings-value');
    if (valueEl) valueEl.textContent = `${pct}%`;
  }
}

function cycleUiScale() {
  uiScaleIdx = (uiScaleIdx + 1) % uiScaleSteps.length;
  applyUiScale();
  localStorage.setItem('cc_ui_scale_idx', String(uiScaleIdx));
}

function applyMotionMode() {
  document.body.classList.remove('motion-low', 'motion-medium', 'motion-high');
  document.body.classList.add(`motion-${motionMode}`);

  const btn = document.getElementById('motion-mode-btn');
  if (btn) {
    const valueEl = btn.querySelector('.settings-value');
    if (valueEl) {
      const label = motionMode === 'low' ? 'Low' : motionMode === 'high' ? 'High' : 'Medium';
      valueEl.textContent = label;
    }
  }
}

function cycleMotionMode() {
  const idx = motionModes.indexOf(motionMode);
  motionMode = motionModes[(idx + 1) % motionModes.length];
  applyMotionMode();
  localStorage.setItem('cc_motion_mode', motionMode);
}

function toggleSettingsPopup() {
  const popup = document.getElementById('settings-popup');
  if (!popup) return;
  const visible = popup.style.display !== 'none';
  popup.style.display = visible ? 'none' : 'block';
}

// Close popup when clicking outside
document.addEventListener('click', (e) => {
  const popup = document.getElementById('settings-popup');
  if (!popup || popup.style.display === 'none') return;
  if (!e.target.closest('.settings-popup') && !e.target.closest('#settings-gear-btn')) {
    popup.style.display = 'none';
  }
});

function clampMapPan() {
  mapView.w = Math.max(mapView.minW, Math.min(mapView.maxW, mapView.w));
  mapView.h = mapView.w * (mapView.baseH / mapView.baseW);

  const maxX = mapView.baseX + mapView.baseW - mapView.w;
  const maxY = mapView.baseY + mapView.baseH - mapView.h;

  mapView.x = Math.min(maxX, Math.max(mapView.baseX, mapView.x));
  mapView.y = Math.min(maxY, Math.max(mapView.baseY, mapView.y));
}

function persistMapView() {
  localStorage.setItem('cc_map_view', JSON.stringify({
    x: mapView.x,
    y: mapView.y,
    w: mapView.w,
    h: mapView.h,
  }));
}

function applyMapTransform() {
  const svg = document.getElementById('map-svg');
  if (!svg) return;
  clampMapPan();
  svg.setAttribute('viewBox', `${mapView.x} ${mapView.y} ${mapView.w} ${mapView.h}`);
}

function zoomMap(factor, cxNorm = 0.5, cyNorm = 0.5) {
  if (factor <= 0) return;

  const prevW = mapView.w;
  const prevH = mapView.h;

  const nextW = Math.max(mapView.minW, Math.min(mapView.maxW, prevW / factor));
  const nextH = nextW * (mapView.baseH / mapView.baseW);

  if (nextW === prevW) return;

  const worldX = mapView.x + cxNorm * prevW;
  const worldY = mapView.y + cyNorm * prevH;

  mapView.w = nextW;
  mapView.h = nextH;
  mapView.x = worldX - cxNorm * nextW;
  mapView.y = worldY - cyNorm * nextH;

  applyMapTransform();
  persistMapView();
}

function resetMapView() {
  mapView.x = mapView.baseX;
  mapView.y = mapView.baseY;
  mapView.w = mapView.baseW;
  mapView.h = mapView.baseH;

  applyMapTransform();
  persistMapView();
}

function initMapInteraction() {
  const area = document.getElementById('map-area');
  if (!area) return;

  const savedOverlay = Number(localStorage.getItem('cc_overlay_mode'));
  if (Number.isFinite(savedOverlay) && savedOverlay >= 0 && savedOverlay < OVERLAY_MODES.length) {
    overlayModeIdx = savedOverlay;
  }
  applyOverlayMode();

  contrastBoost = localStorage.getItem('cc_contrast_boost') === '1';
  applyContrastMode();

  const savedScaleIdx = Number(localStorage.getItem('cc_ui_scale_idx'));
  if (Number.isFinite(savedScaleIdx) && savedScaleIdx >= 0 && savedScaleIdx < uiScaleSteps.length) {
    uiScaleIdx = savedScaleIdx;
  }
  applyUiScale();

  const savedMotionMode = localStorage.getItem('cc_motion_mode');
  if (savedMotionMode && motionModes.includes(savedMotionMode)) {
    motionMode = savedMotionMode;
  }
  applyMotionMode();

  const saved = localStorage.getItem('cc_map_view');
  if (saved) {
    try {
      const s = JSON.parse(saved);
      if (Number.isFinite(+s.w) && Number.isFinite(+s.h) && Number.isFinite(+s.x) && Number.isFinite(+s.y)) {
        mapView.w = +s.w;
        mapView.h = +s.h;
        mapView.x = +s.x;
        mapView.y = +s.y;
      }
    } catch {
      // Ignore malformed saved state
    }
  }
  applyMapTransform();

  area.addEventListener('wheel', (e) => {
    e.preventDefault();

    const rect = area.getBoundingClientRect();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const cxNorm = (e.clientX - rect.left) / Math.max(1, rect.width);
    const cyNorm = (e.clientY - rect.top) / Math.max(1, rect.height);
    zoomMap(factor, cxNorm, cyNorm);
  }, { passive: false });

  area.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.map-controls')) return;
    mapView.dragging = true;
    mapView.lastX = e.clientX;
    mapView.lastY = e.clientY;
    area.classList.add('dragging');
  });

  window.addEventListener('mousemove', (e) => {
    if (!mapView.dragging) return;
    const dx = e.clientX - mapView.lastX;
    const dy = e.clientY - mapView.lastY;
    mapView.lastX = e.clientX;
    mapView.lastY = e.clientY;

    const rect = area.getBoundingClientRect();
    const unitsPerPxX = mapView.w / Math.max(1, rect.width);
    const unitsPerPxY = mapView.h / Math.max(1, rect.height);
    mapView.x -= dx * unitsPerPxX;
    mapView.y -= dy * unitsPerPxY;
    applyMapTransform();
  });

  window.addEventListener('mouseup', () => {
    if (!mapView.dragging) return;
    mapView.dragging = false;
    area.classList.remove('dragging');
    persistMapView();
  });

  window.addEventListener('resize', applyMapTransform);
}

// ── TERRITORY REGION GENERATION (AUTOMATED) ───────────────────
function clipPolygonByHalfPlane(poly, nx, ny, c) {
  if (!poly.length) return [];
  const out = [];

  const inside = (p) => (nx * p.x + ny * p.y) <= c;
  const intersect = (a, b) => {
    const va = nx * a.x + ny * a.y - c;
    const vb = nx * b.x + ny * b.y - c;
    const t = va / (va - vb);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  };

  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const prev = poly[(i + poly.length - 1) % poly.length];
    const curIn = inside(cur);
    const prevIn = inside(prev);

    if (curIn) {
      if (!prevIn) out.push(intersect(prev, cur));
      out.push(cur);
    } else if (prevIn) {
      out.push(intersect(prev, cur));
    }
  }

  return out;
}

function insetPolygon(poly, factor = 0.96) {
  if (poly.length < 3) return poly;
  const centroid = poly.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  centroid.x /= poly.length;
  centroid.y /= poly.length;

  return poly.map(p => ({
    x: centroid.x + (p.x - centroid.x) * factor,
    y: centroid.y + (p.y - centroid.y) * factor,
  }));
}

function buildTerritoryCells(width, height) {
  const bounds = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];

  const cells = {};

  T.forEach(a => {
    let poly = bounds.slice();
    T.forEach(b => {
      if (a.id === b.id || !poly.length) return;
      const nx = b.x - a.x;
      const ny = b.y - a.y;
      const c = (b.x * b.x + b.y * b.y - a.x * a.x - a.y * a.y) / 2;
      poly = clipPolygonByHalfPlane(poly, nx, ny, c);
    });
    cells[a.id] = insetPolygon(poly, 0.88);
  });

  return cells;
}

function polygonToPath(poly) {
  if (!poly || poly.length < 3) return '';
  const start = poly[0];
  let d = `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`;
  for (let i = 1; i < poly.length; i++) {
    d += ` L ${poly[i].x.toFixed(2)} ${poly[i].y.toFixed(2)}`;
  }
  return d + ' Z';
}

// ── FULL MAP RENDER ─────────────────────────────────────────────
function renderMap() {
  const RL = document.getElementById('region-layer');
  const EL = document.getElementById('edge-layer');
  const NL = document.getElementById('node-layer');
  RL.innerHTML = '';
  EL.innerHTML = '';
  NL.innerHTML = '';

  const svg = document.getElementById('map-svg');
  const vb = svg?.viewBox?.baseVal;
  const mapW = vb?.width || 1000;
  const mapH = vb?.height || 800;

  // Draw automated territory regions from node coordinates
  const cells = buildTerritoryCells(mapW, mapH);
  T.forEach(t => {
    const effectiveState = getEffectiveState(t);
    const d = polygonToPath(cells[t.id]);
    if (!d) return;

    const region = svgEl('path', {
      id: `r${t.id}`,
      class: 'tregion',
      d,
      'data-region': t.id,
      'data-state': effectiveState,
    });

    region.addEventListener('click', () => selectT(t.id));
    region.addEventListener('mouseenter', e => showTip(t, e));
    region.addEventListener('mouseleave', hideTip);
    RL.appendChild(region);
  });

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
    const mx = Math.round((ta.x + tb.x) / 2);
    const my = Math.round((ta.y + tb.y) / 2);
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

  applyOverlayMode();
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
  const r = document.getElementById(`r${id}`);
  if (r) r.setAttribute('data-state', state);
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
    const terrMult    = TERRAIN_MULT[t.type] || 1.0;
    const effDef      = t.units * terrMult;
    const ratio       = effAtk / Math.max(1, effDef);
    const winPct      = Math.min(98, Math.max(2, Math.round((ratio / (ratio + 1)) * 100)));
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
      <div class="trow"><span class="tkey">Garrison</span>${(() => {
      if (fog) return '<span class="tval fog-hidden">— — —</span>';
      const g = getGarrisonDisplay(t);
      if (g.exact) return `<span class="tval">${g.label}</span>`;
      return `<span class="tval" style="color:#e9c176;">${g.label} <small>⚠ est.</small></span>`;
    })()}</div>
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

  // BFS scan check
  if (!t.bfsScanned && t.owner !== 'player') {
    btn.textContent = '🔍 Run BFS to Scout';
    btn.disabled = true;
    return;
  }

  // Attack cooldown
  if (attackCooldowns[id] && res.turn < attackCooldowns[id]) {
    btn.textContent = '⏳ Regrouping...';
    btn.disabled = true;
    return;
  }

  // Capital gate
  if (t.type === 'capital' && t.owner === 'enemy' && CAPITAL_GATES[id]) {
    const required = CAPITAL_GATES[id];
    const owned = T.filter(x => x.owner === 'player').length;
    if (owned < required) {
      btn.textContent = `🔒 Need ${required} territories`;
      btn.disabled = true;
      return;
    }
  }

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

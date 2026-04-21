# Crown & Conquest — Implementation Guide

> **Purpose:** Step-by-step coding reference for the complete UI & gameplay overhaul.
> Open this file in VS Code alongside each source file as you implement.

---

## Table of Contents

1. [File: `screen_queue.js` (NEW)](#1-file-screen_queuejs-new)
2. [File: `data.js` — Territory Data Changes](#2-file-datajs)
3. [File: `render.js` — UI, Settings, Overlays, Cinematics](#3-file-renderjs)
4. [File: `algorithms.js` — Costs, Gameplay Roles, Stop Fix](#4-file-algorithmsjs)
5. [File: `battle.js` — Deterministic Battles, Economy, Difficulty, Game Over](#5-file-battlejs)
6. [File: `story.js` — ScreenQueue Integration](#6-file-storyjs)
7. [File: `game.js` — Init Changes, Recruitment, Reset](#7-file-gamejs)
8. [File: `index.html` — HTML Structure Changes](#8-file-indexhtml)
9. [File: `base.css` — Settings Popup, Title, Overflow](#9-file-basecss)
10. [File: `map.css` — Overlay Mode Styles](#10-file-mapcss)
11. [File: `modals.css` — Game Over Modal](#11-file-modalscss)

---

## 1. File: `screen_queue.js` (NEW)

**Location:** `backend/static/js/screen_queue.js`
**Purpose:** Centralized queue ensuring only one screen (modal/cinematic) is active at a time.
**Load order:** Must be loaded BEFORE `algorithms.js` in `index.html`.

### Full Implementation

```js
/* ══════════════════════════════════════════════════════════════
   screen_queue.js  ·  Crown & Conquest — DAA-IV-T241
   Ensures only one major UI screen is active at a time.
   Cinematics play as lead-ins BEFORE modals, never on top.
══════════════════════════════════════════════════════════════ */

const ScreenQueue = (() => {
  // ── STATE ────────────────────────────────────────────────
  let current = null;   // { id, hideFn }
  const queue = [];     // pending entries
  const TRANSITION_GAP_MS = 300;  // gap between screens for visual breathing room

  // ── PUBLIC API ───────────────────────────────────────────

  /**
   * Push a screen onto the queue.
   *
   * @param {string} id        — unique label for this screen (e.g. 'battle', 'story', 'conquest')
   * @param {Function} showFn  — called to display the screen
   * @param {Object} opts
   *   opts.hideFn     {Function} — called to hide the screen when next() is called
   *   opts.cinematic  {Object}   — if provided, plays a cinematic BEFORE showFn:
   *     { type: 'victory'|'defeat'|'battle'|'intel'|'chapter'|'story',
   *       title: 'BRUSSELS FALLS',
   *       subtitle: 'The Eagle advances.',
   *       kicker: 'Imperial Triumph' }
   */
  function push(id, showFn, opts = {}) {
    const entry = {
      id,
      showFn,
      hideFn: opts.hideFn || null,
      cinematic: opts.cinematic || null,
    };

    if (!current) {
      _activate(entry);
    } else {
      queue.push(entry);
    }
  }

  /**
   * Close the current screen and activate the next one in the queue.
   * Call this from every modal's "Continue" / "Close" button.
   */
  function next() {
    if (current && current.hideFn) {
      current.hideFn();
    }
    current = null;

    if (queue.length) {
      setTimeout(() => {
        if (queue.length) {
          _activate(queue.shift());
        }
      }, TRANSITION_GAP_MS);
    }
  }

  /** Returns true if any screen is currently active. */
  function isBlocked() {
    return current !== null;
  }

  /** Returns the id of the current screen, or null. */
  function currentId() {
    return current ? current.id : null;
  }

  /** Force-close everything (used on game reset). */
  function clear() {
    if (current && current.hideFn) current.hideFn();
    current = null;
    queue.length = 0;
  }

  // ── INTERNAL ─────────────────────────────────────────────

  async function _activate(entry) {
    current = { id: entry.id, hideFn: entry.hideFn };

    // If this entry has a cinematic lead-in, play it first and wait
    if (entry.cinematic) {
      const c = entry.cinematic;
      await playCinematicPromise(c.type, c.title, c.subtitle, c.kicker);
      // Brief pause between cinematic fade-out and modal fade-in
      await new Promise(r => setTimeout(r, 200));
    }

    // Now show the actual screen
    entry.showFn();
  }

  return { push, next, isBlocked, currentId, clear };
})();
```

### Algorithm: How the Queue Works

```
State: current = null, queue = []

1. push('battle', showBattleModal, { cinematic: {...} })
   → current is null → _activate() immediately
   → plays cinematic "BATTLE FOR VIENNA" (1.5s)
   → waits 200ms
   → calls showBattleModal()
   → current = { id: 'battle', hideFn: closeBattleModal }

2. push('conquest', showConquestModal, { cinematic: {...} })
   → current is NOT null → pushed to queue
   → queue = [{ id: 'conquest', ... }]

3. User clicks "Continue Campaign" → calls ScreenQueue.next()
   → closeBattleModal() called
   → current = null
   → after 300ms gap, _activate(queue.shift())
   → plays cinematic "VIENNA FALLS" (1.5s)
   → shows conquest modal

4. User clicks "Continue" again → ScreenQueue.next()
   → closeConquestModal() called
   → queue is empty → nothing happens → back to map
```

---

## 2. File: `data.js`

**Location:** `backend/static/js/data.js`
**What to change:** Territory flags. **DO NOT** change coordinates yet (Phase 1.1 is visual tuning done in-browser).

### 2.1 — Add Algorithm Scan Flags to Territories (lines ~11-27)

**Context:** Each territory in the `T` array needs new properties for the algorithm-gameplay integration.

**FIND** each territory object in the `T` array and **ADD** these properties:

```js
// ADD these to EVERY territory object:
bfsScanned: false,     // Set to true when BFS visits this node
dfsScanned: false,     // Set to true when DFS visits this node
onDijkstraPath: false, // Set to true when on computed optimal path
conqueredTurn: 0,      // Turn number when this was conquered (for garrison calc)
```

**Example — before:**
```js
{ id: 0, name:'Paris', x:310, y:280, type:'capital', owner:'player', status:'conquered',
  units:0, gold:0, cost:0, neighbors:[1,2,12], revealed:true },
```

**Example — after:**
```js
{ id: 0, name:'Paris', x:310, y:280, type:'capital', owner:'player', status:'conquered',
  units:0, gold:0, cost:0, neighbors:[1,2,12], revealed:true,
  bfsScanned:true, dfsScanned:true, onDijkstraPath:false, conqueredTurn:0 },
```

> **IMPORTANT:** Paris (id:0) starts with `bfsScanned:true` and `dfsScanned:true` since it's your capital. All other territories start `false`.

### 2.2 — Add Garrison Range Helper (after territory array)

**ADD** this function after the `T` array definition:

```js
/**
 * Returns the displayed garrison range for a territory.
 * Without DFS, the player sees a range (uncertainty).
 * With DFS, the player sees the exact number.
 */
function getGarrisonDisplay(t) {
  if (t.owner === 'player') return { exact: true, value: 0, label: 'Controlled' };
  if (!t.revealed) return { exact: false, value: 0, label: '— — —' };
  if (t.dfsScanned) return { exact: true, value: t.units, label: t.units.toLocaleString() };

  // BFS-only: show a wide range (±60% of actual)
  const min = Math.floor(t.units * 0.4);
  const max = Math.ceil(t.units * 2.2);
  return {
    exact: false,
    min, max,
    label: `${min.toLocaleString()} – ${max.toLocaleString()}`
  };
}
```

### 2.3 — Add `resetGameData()` Changes

**FIND** the `resetGameData()` function. **ADD** reset logic for the new flags:

```js
// Inside resetGameData(), for each territory:
t.bfsScanned = (t.id === 0);    // Only Paris starts scanned
t.dfsScanned = (t.id === 0);
t.onDijkstraPath = false;
t.conqueredTurn = 0;
```

### 2.4 — DO NOT CHANGE

- `EDGES` array — keep as-is
- `ALGO_META` — keep as-is
- `res` object — keep as-is
- `TERRITORY_ATMOSPHERE` — keep as-is
- `MARSHAL_CONQUEST_VOICE` — keep as-is
- Territory `x,y` coordinates — tuned later in-browser

---

## 3. File: `render.js`

**Location:** `backend/static/js/render.js`

### 3.1 — Make `playEventCinematic()` Return a Promise (lines 38-65)

**Context:** The ScreenQueue needs to `await` cinematic completion. Currently the function uses `setTimeout` with no way to wait for it.

**REPLACE** the entire `playEventCinematic` function (lines 38-65) with:

```js
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
```

> **Note:** `playCinematicPromise` waits slightly longer than the animation duration to ensure the fade-out completes before resolving.

### 3.2 — Replace Overlay Toggle with Cycle (lines 30-31, 67-82)

**REPLACE** the overlay variables and functions:

```js
// REPLACE these lines:
// let overlaysVisible = false;
// (and the functions applyOverlayMode, toggleTerritoryOverlays)

// WITH:
const OVERLAY_MODES = ['off', 'ownership', 'threat', 'wealth', 'reachable', 'routes'];
let overlayModeIdx = 0;

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
      region.style.fill = 'rgba(122,184,112,.08)';
      return;
    }

    const val = mode === 'threat' ? t.units : t.gold;
    const intensity = maxVal > 0 ? (val / maxVal) : 0;

    if (mode === 'threat') {
      region.style.fill = `rgba(248,113,113,${0.05 + intensity * 0.35})`;
    } else {
      region.style.fill = `rgba(233,193,118,${0.05 + intensity * 0.35})`;
    }
  });
}

function applyReachableOverlay() {
  const reachable = getReachable();
  T.forEach(t => {
    const region = document.getElementById(`r${t.id}`);
    if (!region) return;

    if (reachable.includes(t.id) && t.owner !== 'player') {
      region.style.fill = 'rgba(138,180,224,.15)';
      region.style.stroke = 'rgba(138,180,224,.6)';
      region.style.strokeWidth = '2';
    }
  });
}
```

### 3.3 — Update `applyContrastMode`, `applyUiScale`, `applyMotionMode`

**Context:** These functions currently set `.textContent` on buttons. With the new settings popup, they need to update the `.settings-value` span inside each option.

**Pattern for each:** Replace the button text update with:

```js
// EXAMPLE for applyContrastMode:
function applyContrastMode() {
  document.body.classList.toggle('contrast-boost', contrastBoost);
  const btn = document.getElementById('contrast-toggle-btn');
  if (btn) {
    const valueEl = btn.querySelector('.settings-value');
    if (valueEl) valueEl.textContent = contrastBoost ? 'On' : 'Off';
  }
}
```

Apply the same pattern to `applyUiScale()` and `applyMotionMode()`.

### 3.4 — Add Settings Popup Toggle

**ADD** after the motion mode functions:

```js
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
```

### 3.5 — Update `initMapInteraction()` (lines 187-267)

**FIND** the overlay init line (line 191):
```js
overlaysVisible = localStorage.getItem('cc_overlays_visible') === '1';
```
**REPLACE** with:
```js
const savedOverlay = Number(localStorage.getItem('cc_overlay_mode'));
if (Number.isFinite(savedOverlay) && savedOverlay >= 0 && savedOverlay < OVERLAY_MODES.length) {
  overlayModeIdx = savedOverlay;
}
```

### 3.6 — Update `updateInfoPanel()` for Garrison Range (lines 506-550)

**FIND** the garrison row (line 545):
```js
<div class="trow"><span class="tkey">Garrison</span>${hiddenVal(t.units.toLocaleString())}</div>
```
**REPLACE** with:
```js
<div class="trow"><span class="tkey">Garrison</span>${(() => {
  if (fog) return '<span class="tval fog-hidden">— — —</span>';
  const g = getGarrisonDisplay(t);
  if (g.exact) return `<span class="tval">${g.label}</span>`;
  return `<span class="tval" style="color:#e9c176;">${g.label} <small>⚠ est.</small></span>`;
})()}</div>
```

### 3.7 — DO NOT CHANGE

- `renderMap()` — keep as-is (territory rendering logic stays the same)
- `buildTerritoryCells()` — keep as-is (Voronoi generation)
- `clampMapPan()`, `zoomMap()`, `resetMapView()` — keep as-is
- `showTip()`, `hideTip()` — keep as-is
- `log()`, `addStep()`, `markVis()`, `toast()` — keep as-is
- `setNS()`, `setEdgeCls()`, `flashNode()` — keep as-is
- `updateRes()` — keep as-is
- `refreshConqBtn()` — modified in battle.js, not here

---

## 4. File: `algorithms.js`

**Location:** `backend/static/js/algorithms.js`

### 4.1 — Add Algorithm Cost Constants & State (top of file, after line 27)

**FIND** line 27 (after `let abortFlag = false;`). **ADD:**

```js
// ── ALGORITHM COSTS & LIMITS ───────────────────────────────────
const ALGO_COSTS = {
  BFS:      100,
  DFS:      400,
  Dijkstra: 300,
  Greedy:   500,
};

let greedyUsedThisChapter = false;
let lastComputedPaths = {};   // Dijkstra results — persisted for overlay mode 'routes'
let firstBfsDone = localStorage.getItem('cc_first_bfs_done') === '1';
```

### 4.2 — Rewrite `runAlgorithm()` with Cost Checks (lines 29-70)

**REPLACE** the entire `runAlgorithm()` function:

```js
async function runAlgorithm() {
  // ── STOP RUNNING ALGORITHM ──
  if (running) {
    abortFlag = true;
    running   = false;
    document.getElementById('run-btn').textContent = '▶ Run Intel';
    // Reset map to clean state — removes visiting/queued visual artifacts
    renderMap();
    if (selId !== null) setNS(selId, 'selected');
    return;
  }

  // ── COST CHECK ──
  const cost = ALGO_COSTS[algo] || 0;
  const isFreeFirstBfs = (algo === 'BFS' && !firstBfsDone);
  const actualCost = isFreeFirstBfs ? 0 : cost;

  if (res.gold < actualCost) {
    toast(`Insufficient gold — ${algo} Intel costs ${cost}g`);
    log(`Cannot afford ${algo} Intel (${cost}g required, ${res.gold}g available).`, 'defeat');
    return;
  }

  // ── GREEDY: 1 PER CHAPTER LIMIT ──
  if (algo === 'Greedy' && greedyUsedThisChapter) {
    toast('Imperial Acquisitions already deployed this chapter.');
    log('Greedy strategy exhausted for this campaign phase.', 'info');
    return;
  }

  // ── DEDUCT COST ──
  res.gold -= actualCost;
  if (isFreeFirstBfs) {
    firstBfsDone = true;
    localStorage.setItem('cc_first_bfs_done', '1');
    log('First BFS scout — complimentary reconnaissance.', 'info');
  } else if (actualCost > 0) {
    log(`Intel expenditure: -${actualCost}g for ${algo} operations.`, 'info');
  }
  updateRes();

  // ── START RUN ──
  abortFlag = false;
  running   = true;
  document.getElementById('run-btn').textContent = '⏹ Stop';
  document.getElementById('step-list').innerHTML = '';

  renderMap();
  if (selId !== null) setNS(selId, 'selected');

  // No cinematic at algorithm START — just a toast
  toast(`${algo} Intel — Computing strategic directives...`);

  const start = 0; // Always start from Paris

  switch (algo) {
    case 'BFS':
      apiGet('/explore/bfs').then(r => {
        if (r) log(`BFS backend: ${r.order.length} territories scanned.`, 'algo');
      });
      await runBFS(start);
      break;
    case 'DFS':
      apiGet('/explore/dfs').then(r => {
        if (r) log(`DFS backend: ${r.order.length} nodes traversed.`, 'algo');
      });
      await runDFS(start);
      break;
    case 'Dijkstra':
      apiGet('/routes').then(r => {
        if (r) log(`Dijkstra backend: paths to ${Object.keys(r.distances).length} cities.`, 'algo');
      });
      await runDijkstra(start);
      break;
    case 'Greedy':
      await runGreedy();
      greedyUsedThisChapter = true;
      break;
  }

  running = false;
  document.getElementById('run-btn').textContent = '▶ Run Intel';
}
```

### 4.3 — Modify `runBFS()` — Add Territory Scanning

**FIND** the BFS main loop where it visits a node. Look for the line where it calls `revealTerritory(v)` or similar.

**ADD** after the node visit:

```js
// ── GAMEPLAY: Mark territory as BFS-scanned ──
T[v].bfsScanned = true;
revealTerritory(v);  // (keep existing reveal call)
```

**Also ADD** at BFS completion (after the loop ends):

```js
// Completion cinematic — only if not stopped and not blocked
if (!abortFlag && !ScreenQueue.isBlocked()) {
  playEventCinematic('intel', 'Reconnaissance Complete',
    `${T.filter(t => t.bfsScanned).length} territories mapped.`, 'Intel Command');
}
```

### 4.4 — Modify `runDFS()` — Add Deep Intelligence

**FIND** the DFS main loop where it visits a node.

**ADD** after the node visit:

```js
// ── GAMEPLAY: Mark territory as DFS deep-scanned ──
T[v].dfsScanned = true;
T[v].bfsScanned = true;  // DFS also reveals (superset of BFS)
revealTerritory(v);
```

**Also ADD** a log for each deep scan:

```js
log(`Deep recon: ${T[v].name} — garrison confirmed: ${T[v].units.toLocaleString()}`, 'algo');
```

**At DFS completion:**

```js
if (!abortFlag && !ScreenQueue.isBlocked()) {
  playEventCinematic('intel', 'Deep Intel Acquired',
    `${T.filter(t => t.dfsScanned).length} territories fully surveyed.`, 'Intelligence Bureau');
}
```

### 4.5 — Modify `runDijkstra()` — Mark Optimal Paths

**FIND** the Dijkstra completion section where it highlights the shortest-path edges.

**Before the path highlighting, ADD:**

```js
// ── GAMEPLAY: Clear previous Dijkstra markings ──
T.forEach(t => { t.onDijkstraPath = false; });

// ── GAMEPLAY: Mark territories on the optimal path tree ──
// 'prev' is the predecessor array from Dijkstra
Object.keys(prev).forEach(nodeId => {
  const id = Number(nodeId);
  if (prev[id] !== undefined && prev[id] !== null) {
    T[id].onDijkstraPath = true;
    T[id].bfsScanned = true;  // Dijkstra also reveals
    revealTerritory(id);
  }
});

// Store paths for the 'routes' overlay mode
lastComputedPaths = { prev: { ...prev }, dist: { ...dist } };
```

**At Dijkstra completion:**

```js
if (!abortFlag && !ScreenQueue.isBlocked()) {
  playEventCinematic('intel', 'Supply Routes Optimized',
    'Conquest costs reduced along computed paths.', 'Logistics Corps');
}

// Auto-switch overlay to 'routes' mode
setOverlayMode('routes');
```

### 4.6 — Modify `runGreedy()` — Cap at 3 Conquests

**FIND** the Greedy loop that auto-conquers territories.

**ADD** a counter:

```js
let greedyConquests = 0;
const GREEDY_MAX = 3;

// Inside the greedy loop, BEFORE each conquest:
if (greedyConquests >= GREEDY_MAX) {
  log(`Imperial Acquisitions: maximum ${GREEDY_MAX} conquests reached.`, 'info');
  break;
}

// AFTER each successful conquest:
greedyConquests++;
```

### 4.7 — DO NOT CHANGE

- Individual algorithm animation logic (the `sleep()` calls, `setNS()`, `addStep()` etc.)
- The `setSpeed()` function
- Edge highlighting visual logic
- The backend API calls (keep as fire-and-forget)

---

## 5. File: `battle.js`

**Location:** `backend/static/js/battle.js`
**This file has the MOST changes.** Work through each section carefully.

### 5.1 — Add New State Variables (top of file, after line 6)

**ADD:**

```js
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
```

### 5.2 — Update `conquerSelected()` — Add New Checks (lines 18-55)

**FIND** the `conquerSelected()` function. **ADD** these checks BEFORE the `openBattle(t)` call:

```js
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
```

### 5.3 — Update `openBattle()` — Use ScreenQueue (lines 57-81)

**REPLACE** the last two lines of `openBattle()`:

```js
// REMOVE these:
// playEventCinematic('battle', `Battle for ${t.name}`, 'Steel meets destiny.', 'War Council');
// document.getElementById('battle-modal').style.display = 'flex';

// REPLACE with:
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
```

### 5.4 — Update `updateBattleOddsDisplay()` — Show Range vs Exact (lines 83-109)

**REPLACE** the function to handle garrison uncertainty:

```js
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

  if (t.dfsScanned) {
    // ── EXACT INTEL ──
    document.getElementById('btl-def').textContent = Math.floor(effDef).toLocaleString();

    const ratio = effAtk / Math.max(1, effDef);
    const fill = document.getElementById('odds-fill');
    let outcome, barColor;

    if (ratio > 1.3) {
      outcome = 'Decisive Victory'; barColor = '#7ab870';
      fill.style.width = '95%';
    } else if (ratio > 1.0) {
      outcome = 'Close Victory'; barColor = '#a8c76a';
      fill.style.width = `${50 + (ratio - 1.0) * 150}%`;
    } else if (ratio > 0.7) {
      outcome = 'Defeat Likely'; barColor = '#e9c176';
      fill.style.width = `${ratio * 50}%`;
    } else {
      outcome = 'Crushing Defeat'; barColor = '#f87171';
      fill.style.width = '10%';
    }

    fill.style.background = barColor;
    document.getElementById('odds-win').textContent = outcome;
    document.getElementById('odds-win').style.color = barColor;
    document.getElementById('odds-lose').textContent = ratio > 1.0 ? '✓ Confirmed' : '✗ Outmatched';
    document.getElementById('odds-lose').style.color = ratio > 1.0 ? '#7ab870' : '#f87171';

  } else {
    // ── ESTIMATED INTEL (no DFS) ──
    const g = getGarrisonDisplay(t);
    document.getElementById('btl-def').textContent = g.label + ' ⚠';

    const bestCase = effAtk / Math.max(1, g.min * terrainMult);
    const worstCase = effAtk / Math.max(1, g.max * terrainMult);

    const fill = document.getElementById('odds-fill');
    const avgPct = Math.round(((bestCase + worstCase) / 2) * 40);
    fill.style.width = Math.min(95, Math.max(5, avgPct)) + '%';
    fill.style.background = 'linear-gradient(90deg, #f87171, #e9c176, #7ab870)';

    document.getElementById('odds-win').textContent = `${Math.round(worstCase * 40)}–${Math.min(98, Math.round(bestCase * 40))}%`;
    document.getElementById('odds-win').style.color = '#e9c176';
    document.getElementById('odds-lose').textContent = '⚠ Unconfirmed';
    document.getElementById('odds-lose').style.color = '#e9c176';
  }
}
```

### 5.5 — REWRITE `resolveBattle()` — Deterministic (lines 213-258)

**REPLACE** the entire `resolveBattle()` function:

```js
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
```

### 5.6 — REWRITE `handleVictory()` (lines 264-317)

**REPLACE** the entire function:

```js
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
```

### 5.7 — REWRITE `handleDefeat()` (lines 319-354)

**REPLACE** the entire function:

```js
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
```

### 5.8 — Update `showDefeatModal()` — Add Revolt Info (lines 432-464)

**ADD** after the resource chips, before the marshal section:

```js
// Revolt warning
if (revoltMsg) {
  const revEl = document.createElement('div');
  revEl.className = 'cq-res-chip negative';
  revEl.style.marginTop = '6px';
  revEl.textContent = `⚠ ${revoltMsg} has revolted!`;
  document.getElementById('df-resources').appendChild(revEl);
}
```

Update the function signature:
```js
function showDefeatModal(t, armyLost, revoltMsg) {
```

### 5.9 — Update `closeConquestModal()` and `closeDefeatModal()` — Use ScreenQueue

**REPLACE** `closeConquestModal()` (lines 418-429):

```js
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
```

**REPLACE** `closeDefeatModal()` (lines 466-476):

```js
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
```

### 5.10 — Update `refreshConqBtn()` — Add New Gates (lines 609-640)

**ADD** these checks at the TOP of the function, right after `const canAttack = ...`:

```js
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
```

### 5.11 — REWRITE `endTurn()` (lines 493-509)

**REPLACE** the entire function:

```js
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
```

### 5.12 — ADD `checkGameOver()` Function

**ADD** after `checkWin()`:

```js
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
```

### 5.13 — ADD `recruitTroops()` Function

**ADD** after `checkGameOver()`:

```js
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
```

### 5.14 — Update `showConquestModal()` — Use New Army Loss Data (lines 357-416)

**FIND** the resource chips section (lines 382-388). **REPLACE:**

```js
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
```

### 5.15 — Update `checkWin()` — Use ScreenQueue (lines 512-558)

**FIND** the last line: `document.getElementById('win-modal').style.display = 'flex';`

**REPLACE** the entire end of the function (from the opening narrative setup) to use ScreenQueue:

```js
// Wrap the entire win display in ScreenQueue
ScreenQueue.push('win',
  () => {
    // ... (keep all existing win modal population code here)

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
```

### 5.16 — Update `initBattleModal()` — Retreat via ScreenQueue (lines 483-488)

**REPLACE:**
```js
function initBattleModal() {
  document.getElementById('btl-retreat').onclick = () => {
    ScreenQueue.next();  // Instead of directly hiding
  };
}
```

### 5.17 — Update `resetGame()` — Clear All New State (lines 561-574)

**ADD** these lines inside `resetGame()`:

```js
ScreenQueue.clear();
Object.keys(attackCooldowns).forEach(k => delete attackCooldowns[k]);
recruitedThisTurn = false;
peakTerritories = 1;
greedyUsedThisChapter = false;
firstBfsDone = false;
localStorage.removeItem('cc_first_bfs_done');
```

### 5.18 — DO NOT CHANGE

- `MARSHAL_ABILITIES` definitions — keep as-is
- `renderMarshalAbilities()` — keep as-is
- `renderCommitButtons()` — keep as-is
- `rollLoot()`, `applyLoot()` — keep as-is
- `TERRITORY_ATMOSPHERE` references — keep as-is
- `MARSHAL_CONQUEST_VOICE` references — keep as-is

---

## 6. File: `story.js`

**Location:** `backend/static/js/story.js`

### 6.1 — Update `check()` — Queue Story Events via ScreenQueue (lines 380-392)

**REPLACE** the `check()` function:

```js
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

  if (!isOpen && queue.length) {
    const ev = queue.shift();
    // Queue via ScreenQueue with cinematic lead-in
    ScreenQueue.push('story',
      () => show(ev),
      {
        hideFn: () => {
          document.getElementById('story-modal').style.display = 'none';
          isOpen = false;
        },
        cinematic: {
          type: 'story',
          title: ev.title,
          subtitle: 'A decision awaits the Emperor.',
          kicker: ev.source,
        },
      }
    );
  }
}
```

### 6.2 — Update `close()` — Use ScreenQueue.next() (find the close function)

**REPLACE:**

```js
function close() {
  ScreenQueue.next();  // hideFn handles modal hiding
  // Story queue processing happens after ScreenQueue advances
  if (queue.length) {
    setTimeout(() => check(), 500);
  }
}
```

### 6.3 — Update `showChapterTransition()` — Use ScreenQueue

**FIND** the chapter transition function. **REPLACE** to use ScreenQueue:

```js
function showChapterTransition(ch) {
  ScreenQueue.push('chapter',
    () => {
      const el = document.getElementById('chapter-transition');
      document.getElementById('ch-numeral').textContent   = ch.numeral;
      document.getElementById('ch-name').textContent       = ch.name;
      document.getElementById('ch-epigraph').textContent   = ch.epigraph;
      el.classList.add('active');

      // Auto-advance after 3.5 seconds
      setTimeout(() => {
        el.classList.remove('active');
        ScreenQueue.next();
      }, 3500);
    },
    {
      hideFn: () => {
        document.getElementById('chapter-transition').classList.remove('active');
      },
    }
  );
}
```

### 6.4 — Add Chapter Change Callback for Greedy Reset

**ADD** to the public API:

```js
// In the return statement at the bottom, ADD:
onChapterChange: (callback) => { _chapterCallbacks.push(callback); },
```

**ADD** at the top of the Story IIFE:
```js
const _chapterCallbacks = [];
```

**In `updateChapter()`**, when a new chapter is entered:
```js
_chapterCallbacks.forEach(cb => cb(newChapter));
```

### 6.5 — Update `reset()` — Clear ScreenQueue

**ADD** inside the `reset()` function:

```js
ScreenQueue.clear();
```

### 6.6 — DO NOT CHANGE

- `EVENTS` array — keep all story events as-is
- `MARSHALS` — keep as-is
- `CHAPTERS` — keep as-is
- Marshal helper functions (`mloy`, `mglory`, `marshalStatus`) — keep as-is
- `getPersonalisedEnding()` — keep as-is
- `show()` function internals — keep as-is (it populates the story modal)
- Win screen population — keep as-is

---

## 7. File: `game.js`

**Location:** `backend/static/js/game.js`

### 7.1 — Add Recruit Button Init

**FIND** the `DOMContentLoaded` event handler. **ADD:**

```js
// Greedy reset on chapter change
Story.onChapterChange(() => {
  greedyUsedThisChapter = false;
});
```

### 7.2 — DO NOT CHANGE

- `buildIntelButtons()` — keep as-is
- `initCollapsibleSections()` — keep as-is
- `syncBackend()` — keep as-is
- Resize handle logic — keep as-is
- `togglePanel()` — keep as-is

---

## 8. File: `index.html`

**Location:** `backend/templates/index.html`

### 8.1 — Add `screen_queue.js` to Script Load Order (line 492)

**ADD** the new script BEFORE `algorithms.js`:

```html
<script src="/static/js/data.js"></script>
<script src="/static/js/render.js"></script>
<script src="/static/js/screen_queue.js"></script>   <!-- NEW — must load before algorithms -->
<script src="/static/js/algorithms.js"></script>
<script src="/static/js/battle.js"></script>
<script src="/static/js/story.js"></script>
<script src="/static/js/auth.js"></script>
<script src="/static/js/game.js"></script>
```

### 8.2 — Replace Map Controls (lines 417-426)

**REPLACE** the entire `.map-controls` div AND add settings popup after it:

```html
<!-- Map controls — compact layout -->
<div class="map-controls">
  <button type="button" class="map-ctrl-btn" onclick="zoomMap(1.15)" title="Zoom in">＋</button>
  <button type="button" class="map-ctrl-btn" onclick="zoomMap(1/1.15)" title="Zoom out">－</button>
  <button type="button" class="map-ctrl-btn" id="settings-gear-btn" onclick="toggleSettingsPopup()" title="Display settings">
    <span class="material-symbols-outlined" style="font-size:16px;">settings</span>
  </button>
</div>

<!-- Settings popup — hidden by default -->
<div class="settings-popup" id="settings-popup" style="display:none;">
  <div class="settings-header">Display Settings</div>
  <button type="button" class="settings-option" id="overlay-toggle-btn" onclick="cycleOverlayMode()">
    <span class="settings-label">Map Intel Mode</span>
    <span class="settings-value">Off</span>
    <span class="settings-hint">Cycle: Off → Ownership → Threat → Wealth → Reachable → Routes</span>
  </button>
  <button type="button" class="settings-option" id="contrast-toggle-btn" onclick="toggleContrastMode()">
    <span class="settings-label">High Contrast</span>
    <span class="settings-value">Off</span>
    <span class="settings-hint">Brighten text &amp; borders for visibility</span>
  </button>
  <button type="button" class="settings-option" id="ui-scale-btn" onclick="cycleUiScale()">
    <span class="settings-label">UI Scale</span>
    <span class="settings-value">100%</span>
    <span class="settings-hint">Increase text and panel sizes</span>
  </button>
  <button type="button" class="settings-option" id="motion-mode-btn" onclick="cycleMotionMode()">
    <span class="settings-label">Animations</span>
    <span class="settings-value">Medium</span>
    <span class="settings-hint">Low = reduced motion for accessibility</span>
  </button>
  <button type="button" class="settings-option" onclick="resetMapView()">
    <span class="settings-label">Reset Map View</span>
    <span class="settings-value">⟳</span>
    <span class="settings-hint">Reset zoom and pan to default</span>
  </button>
</div>
```

### 8.3 — Add Recruit Button to Sidebar Actions (line 384, after conq-btn)

**ADD** between the Conquer button and the Reset button:

```html
<button class="act-btn recruit" id="recruit-btn" onclick="recruitTroops()">💰 Recruit Troops</button>
```

### 8.4 — Add Game Over Modal (after the defeat modal, ~line 231)

**ADD:**

```html
<!-- ════ GAME OVER MODAL ════ -->
<div class="modal-backdrop" id="gameover-modal" style="display:none;">
  <div class="modal gameover-inner">
    <div class="conquest-seal defeat-seal">💀</div>
    <div class="conquest-title defeat-title">THE CAMPAIGN IS LOST</div>
    <div class="gameover-body" id="go-body"></div>
    <div class="story-divider"></div>
    <div class="gameover-stats" id="go-stats"></div>
    <button class="story-continue" onclick="resetGame()">
      ↺ Begin New Campaign
    </button>
  </div>
</div>
```

### 8.5 — Fix Title Bar Overflow (lines 259-262)

**REPLACE:**

```html
<div style="min-width:0; flex-shrink:1; overflow:hidden;">
  <div class="brand">Crown &amp; Conquest</div>
  <div class="subtitle">GRANDE ARMÉE · ALGORITHMIC CAMPAIGN · 1805</div>
</div>
```

### 8.6 — DO NOT CHANGE

- Auth modal — keep as-is
- Intro modal — keep as-is
- Battle modal — keep as-is
- Story modal — keep as-is
- Conquest modal — keep as-is
- Defeat modal — keep as-is
- Chapter transition — keep as-is
- Win modal — keep as-is
- Topbar resource chips — keep as-is
- Sidebar structure — keep as-is (only add recruit button)
- Right log panel — keep as-is
- Mobile bar — keep as-is

---

## 9. File: `base.css`

**Location:** `backend/static/css/base.css`

### 9.1 — Add Settings Popup Styles

**ADD** after the existing `.map-controls` styles:

```css
/* ── SETTINGS POPUP ── */
.settings-popup {
  position: absolute;
  left: 8px;
  top: 58px;
  z-index: 38;
  background: rgba(15, 5, 2, .96);
  border: 1px solid rgba(233,193,118,.24);
  border-radius: var(--radius, 4px);
  padding: 8px 0;
  min-width: 240px;
  box-shadow: 0 8px 32px rgba(0,0,0,.6);
  backdrop-filter: blur(8px);
}

.settings-header {
  font-family: 'Cinzel', serif;
  font-size: .62rem;
  letter-spacing: .2em;
  color: var(--parch2);
  padding: 4px 12px 8px;
  border-bottom: 1px solid rgba(233,193,118,.08);
  text-transform: uppercase;
}

.settings-option {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background .15s;
  text-align: left;
}

.settings-option:hover {
  background: rgba(233,193,118,.06);
}

.settings-label {
  flex: 1;
  font-family: 'Cinzel', serif;
  font-size: .72rem;
  color: var(--gold2, #d4a84b);
  letter-spacing: .04em;
}

.settings-value {
  font-family: 'Cinzel', serif;
  font-size: .68rem;
  color: var(--gold, #e9c176);
  min-width: 60px;
  text-align: right;
}

.settings-hint {
  width: 100%;
  font-family: 'IM Fell English', serif;
  font-size: .58rem;
  color: var(--fog, #6b5e50);
  font-style: italic;
  margin-top: 2px;
  line-height: 1.3;
}
```

### 9.2 — Add Title Bar Overflow Protection

**FIND** the `.brand` rule. **ADD/MODIFY:**

```css
.brand {
  /* ... keep existing properties ... */
  font-size: clamp(.78rem, 1vw, 1.1rem);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.subtitle {
  /* ... keep existing properties ... */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

### 9.3 — Add Cinematic Story Variant

**FIND** the existing cinematic color variants. **ADD:**

```css
#cinematic-event.cinematic-story .cine-title {
  color: #ffe0a0;
  text-shadow: 0 0 28px rgba(233,193,118,.4);
}

#cinematic-event.cinematic-story .cine-kicker {
  color: rgba(233,193,118,.6);
}

#cinematic-event.cinematic-story .cine-content::before {
  background: linear-gradient(90deg, transparent, rgba(233,193,118,.06), transparent);
}
```

### 9.4 — Add Recruit Button Style

**ADD** with the other `.act-btn` variants:

```css
.act-btn.recruit {
  background: linear-gradient(180deg, rgba(233,193,118,.08), rgba(233,193,118,.02));
  border: 1px solid rgba(233,193,118,.25);
  color: var(--gold);
}

.act-btn.recruit:hover {
  background: linear-gradient(180deg, rgba(233,193,118,.15), rgba(233,193,118,.05));
}
```

### 9.5 — DO NOT CHANGE

- Topbar layout rules (except adding overflow protection)
- Sidebar styles
- Panel collapse/expand styles
- Cinematic overlay base styles (keep the letterbox, animation, etc.)
- Toast styles
- Resize handle styles

---

## 10. File: `map.css`

**Location:** `backend/static/css/map.css`

### 10.1 — Add Overlay Mode Classes

**REPLACE** the existing `.overlays-on` / `.overlays-off` rules with new mode-specific rules:

```css
/* ── OVERLAY MODES ── */

/* Default: minimal overlay */
.overlay-off .tregion {
  fill: transparent;
  stroke: transparent;
  filter: none;
}

/* Selected territory always visible regardless of mode */
path.tregion[data-state="selected"] {
  fill: rgba(123,31,31,.22);
  stroke: rgba(233,193,118,.78);
  filter: drop-shadow(0 0 10px rgba(233,193,118,.35));
}

/* Ownership mode — colored by owner */
.overlay-ownership .tregion[data-state="conquered"] { fill: rgba(122,184,112,.08); }
.overlay-ownership .tregion[data-state="scouted"]   { fill: rgba(233,193,118,.05); }
.overlay-ownership .tregion[data-state="unvisited"]  { fill: rgba(233,193,118,.02); }
.overlay-ownership .tregion[data-state="fog"]        { fill: rgba(10,8,6,.3); }
.overlay-ownership .tregion[data-state="enemy"]      { fill: rgba(248,113,113,.07); }

/* Threat & Wealth modes — fills set dynamically by JS (applyHeatMapOverlay) */
.overlay-threat .tregion,
.overlay-wealth .tregion {
  transition: fill .4s ease;
}

/* Reachable mode — pulsing borders set by JS (applyReachableOverlay) */
.overlay-reachable .tregion {
  transition: fill .3s, stroke .3s;
}

@keyframes reachable-pulse {
  0%, 100% { stroke-opacity: .3; }
  50%      { stroke-opacity: .9; }
}

.overlay-reachable .tregion[data-reachable="true"] {
  animation: reachable-pulse 2s ease-in-out infinite;
}

/* Routes mode — Dijkstra paths stay visible, other overlays minimal */
.overlay-routes .tregion { fill: transparent; }
.overlay-routes .edge.active-path {
  stroke-width: 3.6;
  stroke-opacity: .98;
  stroke: #e9c176;
}
```

### 10.2 — DO NOT CHANGE

- Node circle styles (`.ncirc`, data-state variants)
- Edge styles (`.edge`, `.edge.frontier`, `.edge.active-path`, `.edge.traversed`)
- Node label styles (`.nlabel`, `.nlabel-fog`)
- Edge weight label styles (`.ewt`)
- Pulse/battle-flash/conquest-glow animations

---

## 11. File: `modals.css`

**Location:** `backend/static/css/modals.css`

### 11.1 — Add Game Over Modal Styles

**ADD** after the existing defeat modal styles:

```css
/* ── GAME OVER ── */
.gameover-inner {
  max-width: 480px;
  background: linear-gradient(180deg, rgba(30,5,5,.98), rgba(10,2,2,.98));
  border: 2px solid rgba(180,40,40,.3);
}

.gameover-body {
  font-family: 'IM Fell English', serif;
  font-size: .78rem;
  color: var(--parch);
  line-height: 1.7;
  margin: 14px 0;
  font-style: italic;
}

.gameover-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  margin: 12px 0;
}
```

### 11.2 — DO NOT CHANGE

- Auth modal styles
- Intro modal styles
- Battle modal styles
- Conquest modal styles
- Defeat modal styles
- Story modal styles
- Win modal styles
- Chapter transition styles

---

## Implementation Order (Recommended)

Work through these in order — each phase builds on the previous:

1. **`screen_queue.js`** — Create the new file first (everything depends on it)
2. **`data.js`** — Add territory flags (small change, needed by everything)
3. **`index.html`** — HTML structure changes (settings popup, game over modal, script order, recruit button, title fix)
4. **`base.css`** — Settings popup styles, title overflow, recruit button, cinematic-story variant
5. **`map.css`** — Overlay mode CSS classes
6. **`modals.css`** — Game over modal styles
7. **`render.js`** — Cinematic promise, overlay modes, settings toggle, info panel garrison range
8. **`algorithms.js`** — Costs, stop fix, BFS/DFS/Dijkstra/Greedy gameplay roles
9. **`battle.js`** — Deterministic battles, economy, defeat consequences, game over, recruitment (BIGGEST file — do last)
10. **`story.js`** — ScreenQueue integration for story events and chapter transitions
11. **`game.js`** — Init changes, greedy chapter reset

---

## Testing Checklist

After implementing, test in this order:

- [ ] App loads without JS errors (check Console)
- [ ] Settings gear opens popup, all options work
- [ ] BFS costs 100g (first run free), reveals territories
- [ ] Can't attack un-BFS-scanned territory
- [ ] DFS costs 400g, reveals exact garrison numbers
- [ ] Dijkstra costs 300g, shows persistent routes
- [ ] Greedy costs 500g, limited to 1 per chapter, max 3 conquests
- [ ] Battle: stronger attacker always wins (deterministic)
- [ ] Battle: army losses scale with closeness
- [ ] Without DFS: garrison shown as range, odds shown as range
- [ ] With DFS: exact numbers, clear Victory/Defeat label
- [ ] Defeat: -30% enemy garrison (gets stronger, not weaker)
- [ ] Defeat: 25% revolt chance
- [ ] Defeat: cooldown prevents re-attack same territory
- [ ] Garrison income per turn (visible in log)
- [ ] Recruit button: spends gold, gains troops, once per turn
- [ ] Enemy reinforcement escalates (200 → 500 → 1000 → 2000)
- [ ] Turn 10+: enemy counterattack (territory lost)
- [ ] Morale bleed when empire is shrinking
- [ ] Army = 0 → game over screen
- [ ] Morale = 0 → game over screen
- [ ] Territories = 1 (after turn 3) → game over screen
- [ ] No two modals ever stack/overlap
- [ ] Story events get cinematic lead-in with event title
- [ ] Win: cinematic → full story default → campaign stats
- [ ] Capital gates: Berlin (4), Vienna (7), Warsaw (9), Moscow (13)
- [ ] UI scale 130%: no title overflow
- [ ] Overlay cycling: Off → Ownership → Threat → Wealth → Reachable → Routes

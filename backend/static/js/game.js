/* ══════════════════════════════════════════════════════════════
   game.js  ·  Crown & Conquest — DAA-IV-T241
   Entry point: backend API bridge, game init,
   sidebar intel command setup, auth integration.
══════════════════════════════════════════════════════════════ */

// ── BACKEND API BRIDGE ─────────────────────────────────────────
// Optional — game is fully playable without Flask running.
// When Flask IS running, backend stays in sync via /sync.
const API = (
  window.location.origin.includes('localhost') ||
  window.location.origin.includes('127.0.0.1')
) ? window.location.origin : null;

/** GET request — returns parsed JSON or null on any failure */
async function apiGet(path) {
  if (!API) return null;
  try {
    const r = await fetch(API + path, { signal: AbortSignal.timeout(2000) });
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
}

/** POST request with JSON body — returns parsed JSON or null on any failure */
async function apiPost(path, body) {
  if (!API) return null;
  try {
    const r = await fetch(API + path, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(2000),
    });
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
}

/**
 * Push current frontend state to backend so /state, /resources,
 * /controlled always reflect reality. Fire-and-forget — never blocks UI.
 * Called after every action that changes res or territory ownership.
 */
function syncBackend() {
  apiPost('/sync', {
    army:       res.army,
    gold:       res.gold,
    morale:     res.morale,
    turn:       res.turn,
    controlled: T.filter(t => t.owner === 'player').map(t => t.name),
  });
}

/**
 * Auto-save after state-changing actions (conquest, end turn).
 * Called alongside syncBackend. Fire-and-forget.
 */
function autoSave() {
  syncBackend();
  Auth.saveGame();
}

// ── SIDEBAR — INTEL COMMAND BUTTONS ────────────────────────────
// Render algorithm selector buttons using ALGO_META in-world labels
function buildIntelButtons() {
  const container = document.getElementById('intel-btns');
  if (!container) return;
  container.innerHTML = '';

  Object.entries(ALGO_META).forEach(([key, meta]) => {
    const btn = document.createElement('button');
    btn.className = `intel-btn${key === algo ? ' active' : ''}`;
    btn.id = `btn-${key.toLowerCase()}`;
    btn.setAttribute('aria-label', meta.label);
    btn.innerHTML = `
      <div class="iico" style="background:${meta.color};color:${meta.iconCol}">${meta.icon}</div>
      <div>
        <div>${meta.label}</div>
        <div style="font-size:.5rem;opacity:.5;margin-top:1px">${meta.sublabel}</div>
      </div>
      <span class="ibadge">${meta.badge}</span>`;
    btn.onclick = () => selectAlgo(key);
    container.appendChild(btn);
  });
}

// ── COMPLEXITY ACCORDION ────────────────────────────────────────
function initComplexityAccordion() {
  const toggle = document.getElementById('cx-toggle');
  const body   = document.getElementById('cx-body');
  if (!toggle || !body) return;

  toggle.addEventListener('click', () => {
    const open = body.classList.toggle('open');
    toggle.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open);
  });
}

// ── COLLAPSIBLE SIDEBAR SECTIONS ───────────────────────────────
/**
 * Initialize all .sec-toggle buttons as collapsible section headers.
 * Each section remembers its collapsed state in localStorage.
 */
function initCollapsibleSections() {
  document.querySelectorAll('.sec-toggle').forEach(toggle => {
    const section = toggle.dataset.section;
    const bodyEl  = document.getElementById(`${section}-body`);
    if (!bodyEl) return;

    // Restore saved state (default: expanded)
    const savedState = localStorage.getItem(`cc_sec_${section}`);
    if (savedState === 'collapsed') {
      bodyEl.classList.add('collapsed');
      toggle.classList.add('collapsed');
      toggle.setAttribute('aria-expanded', 'false');
    }

    toggle.addEventListener('click', () => {
      const isCollapsed = bodyEl.classList.toggle('collapsed');
      toggle.classList.toggle('collapsed', isCollapsed);
      toggle.setAttribute('aria-expanded', !isCollapsed);
      localStorage.setItem(`cc_sec_${section}`, isCollapsed ? 'collapsed' : 'expanded');
    });
  });

  // Auto-collapse less-essential sections on short viewports
  autoCollapseSections();
  window.addEventListener('resize', debounce(autoCollapseSections, 250));
}

/**
 * On short screens (viewport height < 700px), auto-collapse non-essential
 * sections to prevent overcrowding — but only if user hasn't manually set them.
 */
function autoCollapseSections() {
  const isShort = window.innerHeight < 700;
  const autoSections = ['territory', 'marshals']; // less-essential on short screens

  autoSections.forEach(section => {
    const bodyEl  = document.getElementById(`${section}-body`);
    const toggle  = document.querySelector(`[data-section="${section}"]`);
    if (!bodyEl || !toggle) return;

    // Only auto-collapse if user hasn't explicitly saved a preference
    const userPref = localStorage.getItem(`cc_sec_${section}`);
    if (userPref) return; // user has a preference, respect it

    if (isShort && !bodyEl.classList.contains('collapsed')) {
      bodyEl.classList.add('collapsed');
      toggle.classList.add('collapsed');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}

/** Simple debounce utility */
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ── GAME START ─────────────────────────────────────────────────
function startGame() {
  document.getElementById('intro-modal').style.display = 'none';
  Story.updateMarshals();
  renderMap();
  updateRes();
  log('Campaign initiated. The Emperor awaits victory.', 'info');
  log('Paris is under Imperial control.', 'victory');
  syncBackend();
  setTimeout(() => Story.check(), 2000);
}

// ═══════════════════════════════════════════════════════════════
//  COLLAPSIBLE PANELS + DRAG-TO-RESIZE
// ═══════════════════════════════════════════════════════════════

/**
 * Toggle sidebar or log panel collapsed/expanded.
 * @param {'sidebar'|'log'} panel
 */
function togglePanel(panel) {
  if (panel === 'sidebar') {
    const sidebar   = document.getElementById('sidebar');
    const expandBtn = document.getElementById('sidebar-expand-btn');
    const resizeH   = document.getElementById('resize-left');
    const collapsed = sidebar.classList.toggle('collapsed');

    expandBtn.style.display = collapsed ? 'flex' : 'none';
    resizeH.classList.toggle('hidden', collapsed);
    localStorage.setItem('cc_sidebar_collapsed', collapsed ? '1' : '0');
  } else {
    const logArea   = document.getElementById('log-area');
    const expandBtn = document.getElementById('log-expand-btn');
    const resizeH   = document.getElementById('resize-right');
    const collapsed = logArea.classList.toggle('collapsed');

    expandBtn.style.display = collapsed ? 'flex' : 'none';
    resizeH.classList.toggle('hidden', collapsed);
    localStorage.setItem('cc_log_collapsed', collapsed ? '1' : '0');
  }
}

/**
 * Initialize drag-to-resize handles for sidebar and log panel.
 */
function initResizeHandles() {
  const sidebar  = document.getElementById('sidebar');
  const logArea  = document.getElementById('log-area');
  const layout   = document.getElementById('layout');

  // ── Left resize handle (sidebar ↔ map) ──
  initDragResize('resize-left', (dx) => {
    const currentW = sidebar.getBoundingClientRect().width;
    const newW = Math.max(140, Math.min(400, currentW + dx));
    sidebar.style.width = newW + 'px';
    localStorage.setItem('cc_sidebar_w', newW);
  });

  // ── Right resize handle (map ↔ log) ──
  initDragResize('resize-right', (dx) => {
    const currentW = logArea.getBoundingClientRect().width;
    // Dragging right handle to the left = positive dx means log shrinks
    const newW = Math.max(120, Math.min(360, currentW - dx));
    logArea.style.width = newW + 'px';
    localStorage.setItem('cc_log_w', newW);
  });

  // Restore saved widths from localStorage
  const savedSW = localStorage.getItem('cc_sidebar_w');
  const savedLW = localStorage.getItem('cc_log_w');
  if (savedSW) sidebar.style.width = savedSW + 'px';
  if (savedLW) logArea.style.width  = savedLW + 'px';

  // Restore collapsed states
  if (localStorage.getItem('cc_sidebar_collapsed') === '1') togglePanel('sidebar');
  if (localStorage.getItem('cc_log_collapsed') === '1')     togglePanel('log');
}

/**
 * Generic drag-resize initializer.
 * @param {string} handleId  - The resize handle element ID
 * @param {(dx: number) => void} onDrag - Called with horizontal delta each mousemove
 */
function initDragResize(handleId, onDrag) {
  const handle = document.getElementById(handleId);
  if (!handle) return;

  let startX = 0;

  function onMouseDown(e) {
    e.preventDefault();
    startX = e.clientX;
    handle.classList.add('dragging');
    document.body.classList.add('resizing');
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function onMouseMove(e) {
    const dx = e.clientX - startX;
    startX = e.clientX;
    onDrag(dx);
  }

  function onMouseUp() {
    handle.classList.remove('dragging');
    document.body.classList.remove('resizing');
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  handle.addEventListener('mousedown', onMouseDown);

  // Touch support for tablets
  handle.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startX = e.touches[0].clientX;
    handle.classList.add('dragging');
    document.body.classList.add('resizing');

    function onTouchMove(e) {
      const dx = e.touches[0].clientX - startX;
      startX = e.touches[0].clientX;
      onDrag(dx);
    }

    function onTouchEnd() {
      handle.classList.remove('dragging');
      document.body.classList.remove('resizing');
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    }

    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
  }, { passive: false });
}


// ── DOMContentLoaded ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  buildIntelButtons();
  initComplexityAccordion();
  initCollapsibleSections();
  initBattleModal();
  initResizeHandles();

  // Set complexity box to default algo (Dijkstra)
  const m = ALGO_META[algo];
  document.getElementById('cx-time').textContent  = m.time;
  document.getElementById('cx-space').textContent = m.space;
  document.getElementById('cx-desc').textContent  = m.desc;

  updateRes();
  Story.updateMarshals();
  Story.updateChapter();

  // Auth: check session → show login or intro
  Auth.initKeyboard();
  Auth.checkSession();
});

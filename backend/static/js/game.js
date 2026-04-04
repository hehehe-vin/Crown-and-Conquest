/* ══════════════════════════════════════════════════════════════
   game.js  ·  Crown & Conquest — DAA-IV-T241
   Entry point: backend API bridge, game init,
   sidebar intel command setup.
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

// ── DOMContentLoaded ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  buildIntelButtons();
  initComplexityAccordion();
  initBattleModal();

  // Set complexity box to default algo (Dijkstra)
  const m = ALGO_META[algo];
  document.getElementById('cx-time').textContent  = m.time;
  document.getElementById('cx-space').textContent = m.space;
  document.getElementById('cx-desc').textContent  = m.desc;

  updateRes();
  Story.updateMarshals();
  Story.updateChapter();
});

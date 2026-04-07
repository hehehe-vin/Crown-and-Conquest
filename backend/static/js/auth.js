/* ══════════════════════════════════════════════════════════════
   auth.js  ·  Crown & Conquest — DAA-IV-T241
   Login / Signup / Guest mode logic.
   Exposed as the global `Auth` object.
══════════════════════════════════════════════════════════════ */

const Auth = (() => {

  let loggedIn  = false;
  let username  = null;
  let hasSave   = false;
  let isGuest   = false;

  // ── DOM helpers ──────────────────────────────────────────────

  const $ = id => document.getElementById(id);

  function showTab(tab) {
    $('auth-login-form').style.display   = tab === 'login'  ? 'block' : 'none';
    $('auth-signup-form').style.display  = tab === 'signup' ? 'block' : 'none';
    $('auth-tab-login').classList.toggle('active',  tab === 'login');
    $('auth-tab-signup').classList.toggle('active', tab === 'signup');
    $('auth-error').textContent = '';
  }

  function showError(msg) {
    const el = $('auth-error');
    el.textContent = msg;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = 'auth-shake .4s ease';
  }

  function setLoading(btn, loading) {
    btn.disabled = loading;
    btn.dataset.origText = btn.dataset.origText || btn.textContent;
    btn.textContent = loading ? '...' : btn.dataset.origText;
  }

  // ── API Calls ────────────────────────────────────────────────

  async function apiAuth(path, body) {
    try {
      const r = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'same-origin',
      });
      return await r.json();
    } catch {
      return { ok: false, error: 'Connection failed.' };
    }
  }

  // ── Login ───────────────────────────────────────────────────

  async function login() {
    const user = $('auth-login-user').value.trim();
    const pass = $('auth-login-pass').value;
    if (!user || !pass) return showError('Enter username and password.');

    const btn = $('auth-login-btn');
    setLoading(btn, true);

    const res = await apiAuth('/api/auth/login', { username: user, password: pass });
    setLoading(btn, false);

    if (res.ok) {
      loggedIn = true;
      username = res.username;
      hasSave  = res.hasSave;
      onAuthSuccess();
    } else {
      showError(res.error || 'Login failed.');
    }
  }

  // ── Signup ──────────────────────────────────────────────────

  async function signup() {
    const user    = $('auth-signup-user').value.trim();
    const pass    = $('auth-signup-pass').value;
    const confirm = $('auth-signup-confirm').value;

    if (!user || !pass) return showError('Fill in all fields.');
    if (user.length < 2) return showError('Username must be at least 2 characters.');
    if (pass.length < 4) return showError('Password must be at least 4 characters.');
    if (pass !== confirm) return showError('Passwords do not match.');

    const btn = $('auth-signup-btn');
    setLoading(btn, true);

    const res = await apiAuth('/api/auth/signup', { username: user, password: pass });
    setLoading(btn, false);

    if (res.ok) {
      loggedIn = true;
      username = res.username;
      hasSave  = false;
      onAuthSuccess();
    } else {
      showError(res.error || 'Signup failed.');
    }
  }

  // ── Guest Mode ─────────────────────────────────────────────

  function enterGuest() {
    isGuest  = true;
    loggedIn = false;
    hasSave  = false;
    username = 'Guest';
    onAuthSuccess();
  }

  // ── Logout ──────────────────────────────────────────────────

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    loggedIn = false;
    username = null;
    hasSave  = false;
    isGuest  = false;
    location.reload();
  }

  // ── Session Check (on page load) ────────────────────────────

  async function checkSession() {
    try {
      const r = await fetch('/api/auth/me', { credentials: 'same-origin' });
      const data = await r.json();
      if (data.ok) {
        loggedIn = true;
        username = data.username;
        hasSave  = data.hasSave;
        onAuthSuccess();
        return;
      }
    } catch {}

    // No session — show login screen
    $('auth-modal').style.display = 'flex';
  }

  // ── After Successful Auth ───────────────────────────────────

  function onAuthSuccess() {
    // Hide auth modal
    $('auth-modal').style.display = 'none';

    // Update topbar with username
    const userEl = $('user-display');
    if (userEl) {
      userEl.textContent = username;
      userEl.style.display = 'inline';
    }

    // Show logout button (if logged in, not guest)
    const logoutBtn = $('logout-btn');
    if (logoutBtn) {
      logoutBtn.style.display = isGuest ? 'none' : 'inline-block';
    }

    // If there's an existing save, offer to continue
    if (hasSave && !isGuest) {
      showContinuePrompt();
    } else {
      // Show the normal intro modal
      $('intro-modal').style.display = 'flex';
    }
  }

  // ── Continue Prompt ─────────────────────────────────────────

  function showContinuePrompt() {
    const intro = $('intro-modal');
    intro.style.display = 'flex';

    // Replace the Begin Campaign button area with continue/new choice
    const btnArea = $('intro-btn-area');
    if (btnArea) {
      btnArea.innerHTML = `
        <button class="mbtn" id="btn-continue-save" style="margin-bottom:6px;width:100%;">
          Continue Campaign ▶
        </button>
        <button class="mbtn sec" id="btn-new-campaign" style="width:100%;">
          New Campaign
        </button>
      `;

      $('btn-continue-save').onclick = async () => {
        const success = await loadSavedGame();
        if (success) {
          intro.style.display = 'none';
          Story.updateMarshals();
          renderMap();
          updateRes();
          log('Campaign resumed. The Emperor returns.', 'info');
          syncBackend();
        } else {
          showError('Failed to load save. Starting new campaign.');
          startGame();
        }
      };

      $('btn-new-campaign').onclick = () => {
        // Delete old save and start fresh
        if (!isGuest) {
          fetch('/api/save', { method: 'DELETE', credentials: 'same-origin' });
        }
        btnArea.innerHTML = `<button class="mbtn" onclick="startGame()">Begin Campaign</button>`;
        startGame();
      };
    }
  }

  // ── Save Game ───────────────────────────────────────────────

  async function saveGame() {
    if (isGuest || !loggedIn) return;

    const state = getFullState();
    try {
      await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
        credentials: 'same-origin',
      });
    } catch {}
  }

  // ── Load Game ───────────────────────────────────────────────

  async function loadSavedGame() {
    if (isGuest || !loggedIn) return false;

    try {
      const r = await fetch('/api/load', { credentials: 'same-origin' });
      const result = await r.json();
      if (result.ok && result.data) {
        restoreFullState(result.data);
        return true;
      }
    } catch {}
    return false;
  }

  // ── Keyboard Support ────────────────────────────────────────

  function initKeyboard() {
    document.addEventListener('keydown', e => {
      if ($('auth-modal').style.display !== 'flex') return;
      if (e.key !== 'Enter') return;

      if ($('auth-login-form').style.display !== 'none') {
        login();
      } else {
        signup();
      }
    });
  }

  // ── Public API ──────────────────────────────────────────────

  return {
    checkSession,
    login,
    signup,
    logout,
    enterGuest,
    showTab,
    saveGame,
    loadSavedGame,
    initKeyboard,
    get isGuest() { return isGuest; },
    get loggedIn() { return loggedIn; },
    get username() { return username; },
  };

})();

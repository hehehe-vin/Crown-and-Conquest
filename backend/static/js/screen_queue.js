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

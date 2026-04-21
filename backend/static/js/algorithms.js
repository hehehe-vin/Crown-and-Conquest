/* ══════════════════════════════════════════════════════════════
   algorithms.js  ·  Crown & Conquest — DAA-IV-T241
   Local animated implementations of BFS, DFS, Dijkstra, Greedy.
   Each mirrors the Python backend algorithm in behaviour.
   Backend is called for logging but frontend drives the animation.
══════════════════════════════════════════════════════════════ */

// ── INTEL COMMAND SELECTION ─────────────────────────────────────
function selectAlgo(name) {
  algo = name;
  document.querySelectorAll('.intel-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('btn-' + name.toLowerCase());
  if (btn) btn.classList.add('active');

  const m = ALGO_META[name];
  document.getElementById('cx-time').textContent  = m.time;
  document.getElementById('cx-space').textContent = m.space;
  document.getElementById('cx-desc').textContent  = m.desc;
  document.getElementById('hud-algo').textContent  = name;
}

function setSpeed(v) {
  animMs = +v;
  const ratio = 750 / animMs;
  document.getElementById('spd-lbl').textContent = ratio.toFixed(1) + 'x';
}

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

// ── MAIN RUNNER ─────────────────────────────────────────────────
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

// ── BFS ─────────────────────────────────────────────────────────
// Time: O(V+E)  Space: O(V)
// Reveals (scouts) adjacent territories as it visits them — fog of war integration
async function runBFS(start) {
  const vis   = new Set([start]);
  const queue = [start];
  let level = 0;

  addStep('Queue: [Paris]', 'cur');

  while (queue.length && !abortFlag) {
    const u = queue.shift();
    const t = T[u];

    // ── GAMEPLAY: Mark territory as BFS-scanned ──
    T[u].bfsScanned = true;
    revealTerritory(u);

    if (u !== selId) setNS(u, 'visiting');
    addStep(`L${level} Visit: ${t.name}`, 'cur');
    log(`BFS → ${t.name} (level ${level})`, 'algo');

    for (const v of t.neighbors) {
      if (!vis.has(v)) {
        vis.add(v);
        queue.push(v);
        // Scouting: reveal territory when BFS reaches it
        revealTerritory(v);
        setNS(v, 'queued');
        setEdgeCls(u, v, 'frontier');
        addStep(`  → Scouted: ${T[v].name}`, 'que');
      }
    }

    await sleep(animMs);
    if (abortFlag) break;

    if (t.status !== 'conquered' && u !== selId) setNS(u, T[u].status);
    markVis();
    level++;
  }

  if (!abortFlag) {
    addStep('Scout Complete ✓', 'cur');
    log(`BFS scouted ${vis.size} territories from Paris.`, 'victory');
    toast(`${vis.size} territories scouted`);
    // Completion cinematic — only if not stopped and not blocked
    if (!abortFlag && !ScreenQueue.isBlocked()) {
      playEventCinematic('intel', 'Reconnaissance Complete',
        `${T.filter(t => t.bfsScanned).length} territories mapped.`, 'Intel Command');
    }
    renderMap();
    if (selId !== null) setNS(selId, 'selected');
    // Update conq button if a territory is selected
    if (selId !== null) refreshConqBtn(selId);
  }
}

// ── DFS ─────────────────────────────────────────────────────────
// Time: O(V+E)  Space: O(V)
// Deep recon — explores maximum depth first
async function runDFS(start) {
  const vis = new Set();
  addStep('Stack: [Paris]', 'cur');

  async function dfsVisit(u) {
    if (abortFlag || vis.has(u)) return;
    vis.add(u);
    const t = T[u];

    // ── GAMEPLAY: Mark territory as DFS deep-scanned ──
    T[u].dfsScanned = true;
    T[u].bfsScanned = true;  // DFS also reveals (superset of BFS)
    revealTerritory(u);

    if (u !== selId) setNS(u, 'visiting');
    addStep(`Visit: ${t.name} (depth ${vis.size})`, 'cur');
    log(`DFS → ${t.name}`, 'algo');
    log(`Deep recon: ${T[u].name} — garrison confirmed: ${T[u].units.toLocaleString()}`, 'algo');

    await sleep(animMs);
    if (abortFlag) return;

    for (const v of t.neighbors) {
      if (!vis.has(v)) {
        revealTerritory(v);
        setNS(v, 'queued');
        setEdgeCls(u, v, 'frontier');
        addStep(`  Push: ${T[v].name}`, 'que');
        await dfsVisit(v);
        if (abortFlag) return;
      }
    }

    if (t.status !== 'conquered' && u !== selId) setNS(u, T[u].status);
    markVis();
  }

  await dfsVisit(start);

  if (!abortFlag) {
    addStep('Recon Complete ✓', 'cur');
    log(`DFS traversed ${vis.size} territories.`, 'victory');
    toast(`Deep recon: ${vis.size} territories`);
    if (!abortFlag && !ScreenQueue.isBlocked()) {
      playEventCinematic('intel', 'Deep Intel Acquired',
        `${T.filter(t => t.dfsScanned).length} territories fully surveyed.`, 'Intelligence Bureau');
    }
    renderMap();
    if (selId !== null) setNS(selId, 'selected');
    if (selId !== null) refreshConqBtn(selId);
  }
}

// ── DIJKSTRA ─────────────────────────────────────────────────────
// Time: O((V+E) log V)  Space: O(V)
// Optimal supply route planning — highlights cheapest invasion paths
async function runDijkstra(start) {
  const dist = {};
  const prev = {};
  T.forEach(t => { dist[t.id] = Infinity; prev[t.id] = null; });
  dist[start] = 0;

  const pq  = [{ id: start, d: 0 }];
  const vis = new Set();

  addStep('Init: dist[Paris]=0', 'cur');

  while (pq.length && !abortFlag) {
    pq.sort((a, b) => a.d - b.d);
    const { id: u } = pq.shift();
    if (vis.has(u)) continue;
    vis.add(u);

    const t = T[u];
    if (u !== selId) setNS(u, 'visiting');
    addStep(`Route: ${t.name} (d=${dist[u]})`, 'cur');
    log(`Dijkstra: ${t.name} dist=${dist[u]}`, 'algo');

    for (const v of t.neighbors) {
      const w  = edgeW(u, v);
      const nd = dist[u] + w;
      if (nd < dist[v]) {
        dist[v] = nd;
        prev[v] = u;
        pq.push({ id: v, d: nd });
        setEdgeCls(u, v, 'frontier');
        revealTerritory(v);
        if (T[v].status !== 'conquered') setNS(v, 'queued');
        addStep(`  Relax: ${T[v].name}=${nd}`, 'que');
      }
    }

    await sleep(animMs);
    if (abortFlag) break;

    if (t.status !== 'conquered' && u !== selId) setNS(u, T[u].status);
    markVis();
  }

  if (!abortFlag) {
    renderMap();
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

    // Highlight optimal paths with gold edges
    T.forEach(t => {
      let n = t.id;
      while (prev[n] !== null) {
        setEdgeCls(prev[n], n, 'active-path');
        n = prev[n];
      }
    });
    addStep('Routes Computed ✓', 'cur');
    log(`Dijkstra: optimal supply routes to ${vis.size} cities found.`, 'victory');
    toast('Supply routes computed!');
    if (!abortFlag && !ScreenQueue.isBlocked()) {
      playEventCinematic('intel', 'Supply Routes Optimized',
        'Conquest costs reduced along computed paths.', 'Logistics Corps');
    }

    // Auto-switch overlay to 'routes' mode
    setOverlayMode('routes');
    if (selId !== null) {
      setNS(selId, 'selected');
      refreshConqBtn(selId);
    }
  }
}

// ── GREEDY ───────────────────────────────────────────────────────
// Time: O(n log n)  Space: O(n)
// Maximises gold-per-cost ratio — fast but not globally optimal
async function runGreedy() {
  addStep('Rank by gold/cost ratio', 'cur');
  log('Greedy: prioritise highest gold/cost ratio.', 'algo');

  let turns = 0;
  let greedyConquests = 0;
  const GREEDY_MAX = 3;

  while (turns < 10 && !abortFlag) {
    // Inside the greedy loop, BEFORE each conquest:
    if (greedyConquests >= GREEDY_MAX) {
      log(`Imperial Acquisitions: maximum ${GREEDY_MAX} conquests reached.`, 'info');
      break;
    }

    turns++;
    // Only consider revealed, scouted, non-player territories that are reachable
    const reachableIds = getReachable();
    const cands = T.filter(t =>
      reachableIds.includes(t.id) &&
      t.revealed &&
      t.owner !== 'player' &&
      t.cost > 0
    );

    if (!cands.length) {
      addStep('No valid targets', 'que');
      break;
    }

    cands.sort((a, b) => (b.gold / b.cost) - (a.gold / a.cost));
    const best = cands[0];

    setNS(best.id, 'greedy');
    addStep(`Turn ${turns}: ${best.name} (ratio=${(best.gold/best.cost).toFixed(0)})`, 'cur');
    log(`Greedy selects ${best.name} (gold/cost=${(best.gold/best.cost).toFixed(1)})`, 'algo');

    await sleep(animMs);
    if (abortFlag) break;

    const cg = best.cost * 50;
    const ca = best.cost * 500;

    if (res.gold < cg || res.army < ca) {
      addStep('  ✗ Insufficient resources', 'que');
      log(`Insufficient resources for ${best.name}. Need ${cg}g / ${ca} troops.`, 'defeat');
      break;
    }

    res.gold  -= cg;
    res.army  -= ca;
    res.gold  += best.gold;
    res.morale = Math.min(100, res.morale + 3);

    best.status = 'conquered';
    best.owner  = 'player';
    best.revealed = true;

    // Scout adjacent territories
    best.neighbors.forEach(nid => {
      if (T[nid].status === 'unvisited') {
        revealTerritory(nid);
        setEdgeCls(best.id, nid, 'frontier');
      }
    });

    setNS(best.id, 'conquered');
    flashNode(best.id, 'conquest-flash', 800);

    // AFTER each successful conquest:
    greedyConquests++;

    addStep(`  ✓ Acquired ${best.name} (+${best.gold}g)`, 'vis');
    log(`Greedy acquired ${best.name}! +${best.gold}g`, 'victory');

    updateRes();
    await sleep(animMs / 2);
    renderMap();
    if (selId !== null) setNS(selId, 'selected');
    checkWin();
  }

  if (!abortFlag) {
    addStep('Greedy pass complete ✓', 'cur');
    log('Imperial Acquisitions pass complete.', 'victory');
    toast('Greedy strategy executed!');
    playEventCinematic('intel', 'Acquisition Pass Complete', 'Resource-priority expansion executed.', 'Intel Complete');
    renderMap();
    if (selId !== null) setNS(selId, 'selected');
  }
}

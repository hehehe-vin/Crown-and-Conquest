# Crown & Conquest — DAA-IV-T241
**Team:** Algorithmic Empire · Graphic Era University  
**Members:** Sushmit Singh Rawat · Vinayak Suyal · Kanak Rawat

---

## Project Structure

```
crown_conquest/
├── app.py                  ← Flask server  (all API routes)
├── game_engine.py          ← Central controller (wires everything)
├── map_graph.py            ← Graph data structure
├── war_engine.py           ← Battle simulation
├── decision_engine.py      ← Strategic choice generator
├── requirements.txt
│
├── algorithms/
│   ├── bfs.py              ← O(V+E)        Breadth-First Search
│   ├── dfs.py              ← O(V+E)        Depth-First Search
│   └── dijkstra.py         ← O((V+E)logV)  Dijkstra Shortest Path
│
├── data/
│   └── map_data.py         ← 15-node Europe graph + territory metadata
│
└── templates/
    └── index.html          ← Complete frontend (medieval map + story engine)
```

---

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run the server
python app.py

# 3. Open in browser
#    http://127.0.0.1:5000
```

---

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | Serves the game UI |
| GET | `/graph` | Full adjacency list + metadata |
| GET | `/explore/bfs` | BFS from Paris — visit order & levels |
| GET | `/explore/dfs` | DFS from Paris — visit order & parent tree |
| GET | `/routes` | Dijkstra — cheapest path to every city |
| GET | `/routes/<city>` | Dijkstra path to a specific city |
| GET | `/reachable` | BFS adjacency — legal invasion targets |
| GET | `/invade/<city>` | Attempt conquest — returns battle report |
| GET | `/state` | Full game snapshot |
| GET | `/resources` | Army, gold, morale, turn |
| GET | `/choices` | Strategic choices available |
| POST | `/endturn` | Advance turn, collect tax |
| POST | `/reset` | Reset game to initial state |

---

## Algorithms Implemented

### BFS — Breadth-First Search
- **File:** `algorithms/bfs.py`
- **Use:** Territory exploration from Paris — finds all reachable lands
- **Time:** O(V + E)  |  **Space:** O(V)
- Also powers the **reachable targets** check: which enemy territories border your empire

### DFS — Depth-First Search  
- **File:** `algorithms/dfs.py`
- **Use:** Deep path traversal — explores corridors before spreading
- **Time:** O(V + E)  |  **Space:** O(V) recursion stack

### Dijkstra's Algorithm
- **File:** `algorithms/dijkstra.py`
- **Use:** Finds the cheapest conquest route from Paris to any city
- **Time:** O((V + E) log V) with min-heap  |  **Space:** O(V)
- Edge weights = invasion cost; Dijkstra returns full path + cumulative cost

### Greedy Resource Allocation
- **Location:** `templates/index.html` (frontend, JavaScript)
- **Use:** Ranks unconquered territories by `gold_reward / cost` ratio
- **Time:** O(n log n) per turn (sort + sweep)

---

## Graph — Europe as an Adjacency List

**15 nodes** (territories) · **weighted undirected edges** (border invasion cost)

```
Paris ←→ London (4), Brussels (3), Madrid (6)
Brussels ←→ Amsterdam (2), Berlin (5)
Berlin ←→ Copenhagen (4), Prague (3), Warsaw (5)
Prague ←→ Munich (3), Vienna (4), Warsaw (4)
...
Warsaw ←→ Moscow (7)
```

Dijkstra's cheapest path: **Paris → Moscow = 20**  
Route: Paris → Brussels → Berlin → Warsaw → Moscow

---

## Known Bugs Fixed (from original submission)

| File | Bug | Fix |
|------|-----|-----|
| `decision_engine.py` | `return` on its own line before the list — always returned `None` | Moved `return` to same line as value |
| `game_engine.py` | `choices()` method called in `app.py` but didn't exist | Added method, wired to `DecisionEngine` |
| `game_engine.py` | No resource tracking (army/gold/morale) | Full resource state with `STARTING_*` constants |
| `map_data.py` | Only 7 countries; frontend has 15 | Expanded to all 15 territories matching frontend |
| Missing | `bfs.py` didn't exist at all | Created with BFS + `bfs_reachable_from_controlled` |
| `index.html` | `EVENTS` array closed at line 1302 before C1–C11 events | Removed premature `];` — all 20 events now fire |
| `index.html` | Marshal panel had no CSS, no renderer, never rendered | Full CSS + `updateMarshals()` renderer added |
| `index.html` | `Story.reset()` didn't reset marshal state | Added full marshal object reset |

---

## Story & Marshal System

The game contains **20 story events** divided into two groups:

**Situational events** (fire on game conditions):
`first_blood`, `channel`, `prussia`, `coalition`, `morale_crisis`, `treasury`, `moscow`, `overextension`, `vienna_falls`

**Character arc events** (fire on relationships + turn count):
`murat_ambition`, `talleyrand_warning`, `ney_glory`, `josephine`, `spy_court`, `berthier_doubt`, `pope_gambit`, `marshal_defection`, `emperors_doubt`, `madrid_falls`, `road_home`

**Five marshals** with live `loyalty` (0–100) and `glory` (0–∞) scores:
- Murat · Ney · Berthier · Talleyrand · Josephine
- Loyalty affects `marshal_defection` trigger threshold
- Glory ≥ 40 → status becomes "Legend" in sidebar + win screen
- Marshal state shown in sidebar: Loyal / Wavering / Hostile / Legend / Fallen

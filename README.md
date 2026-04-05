# Crown & Conquest — DAA-IV-T241
**Team:** Algorithmic Empire · Graphic Era University  
**Members:** Sushmit Singh Rawat · Vinayak Suyal · Kanak Rawat

> *A narrative-driven strategy game where you play as Napoleon Bonaparte,
> conquering Europe one territory at a time — powered by graph algorithms.*

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Project Structure](#project-structure)
3. [Downloading Assets](#downloading-assets)
4. [API Endpoints](#api-endpoints)
5. [Algorithms Implemented](#algorithms-implemented)
6. [Graph — Europe as an Adjacency List](#graph--europe-as-an-adjacency-list)
7. [Narrative & Story System](#narrative--story-system)
8. [Marshal System](#marshal-system)
9. [UI & Screens](#ui--screens)
10. [Responsive Design](#responsive-design)
11. [Known Bugs Fixed](#known-bugs-fixed)

---

## Quick Start

### Prerequisites

- **Python 3.8+**
- **pip** (Python package manager)
- Internet connection *(first run only — for downloading the map and fonts)*

### Installation

```bash
# 1. Clone the repository
git clone <repository-url>
cd "Crown and Conquest"

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Download the map image and fonts (REQUIRED on first run)
cd backend
python download_assets.py

# 4. Start the server
python app.py

# 5. Open in your browser
#    http://127.0.0.1:5000
```

> **Note:** Step 3 only needs to be run **once**. After that, all assets are
> stored locally and the game works fully offline.

---

## Project Structure

```
Crown and Conquest/
├── README.md
├── requirements.txt
│
├── backend/
│   ├── app.py                  ← Flask server (all API routes)
│   ├── game_engine.py          ← Central controller (wires everything)
│   ├── map_graph.py            ← Graph data structure
│   ├── war_engine.py           ← Battle simulation
│   ├── decision_engine.py      ← Strategic choice generator
│   ├── download_assets.py      ← Asset downloader (map + fonts)
│   │
│   ├── algorithms/
│   │   ├── bfs.py              ← O(V+E)        Breadth-First Search
│   │   ├── dfs.py              ← O(V+E)        Depth-First Search
│   │   └── dijkstra.py         ← O((V+E)logV)  Dijkstra Shortest Path
│   │
│   ├── data/
│   │   └── map_data.py         ← 15-node Europe graph + territory metadata
│   │
│   ├── static/
│   │   ├── map.png             ← Napoleonic Europe map background
│   │   ├── css/
│   │   │   ├── base.css        ← Design tokens, reset, layout skeleton
│   │   │   ├── map.css         ← SVG map node/edge/label styles
│   │   │   └── modals.css      ← All modal, story, battle & overlay styles
│   │   ├── js/
│   │   │   ├── game.js         ← Entry point, API sync, UI initialisation
│   │   │   ├── data.js         ← Territory data, loot tables, game state
│   │   │   ├── render.js       ← SVG map rendering, tooltips, UI updates
│   │   │   ├── algorithms.js   ← Frontend BFS/DFS/Dijkstra visualisation
│   │   │   ├── battle.js       ← Battle logic, marshal abilities, result modals
│   │   │   └── story.js        ← Narrative engine, 17 events, 5 chapters
│   │   └── fonts/              ← Downloaded Google Fonts (offline)
│   │
│   └── templates/
│       └── index.html          ← Complete frontend (map + story + modals)
│
├── chapter1.txt — chapter5.txt ← Source narrative prose (reference only)
└── prompt.txt                  ← Narrative design brief
```

---

## Downloading Assets

The game requires a map image and Google Fonts to run. These are **not**
included in the repository. Run the download script once:

```bash
cd backend
python download_assets.py
```

### What it downloads

| Asset | Destination | Size |
|-------|------------|------|
| Napoleonic Europe map | `static/map.png` | ~530 KB |
| Cinzel font (woff2) | `static/fonts/` | ~60 KB |
| Crimson Text font (woff2) | `static/fonts/` | ~40 KB |
| IM Fell English font (woff2) | `static/fonts/` | ~50 KB |
| Material Symbols icons (woff2) | `static/fonts/` | ~200 KB |

### If the download fails

If `download_assets.py` cannot reach the servers (firewall, proxy, etc.):

1. **Map image** — Place your own map at `backend/static/map.jpg` or `map.png`
2. **Fonts** — The game will fall back to system serif fonts. To use Google
   Fonts online, ensure the `<link>` tags in `index.html` point to the
   Google Fonts CDN instead of `/static/fonts/`.

### Verifying assets are downloaded

```bash
# Check the map exists
ls backend/static/map.*

# Check fonts were downloaded
ls backend/static/fonts/
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
- **Location:** `static/js/battle.js` (frontend, JavaScript)
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

## Narrative & Story System

The game features a **5-chapter narrative arc** told through Napoleon's internal
monologue. Every mechanical action — territory conquest, resource management,
marshal interactions — is framed through immersive, character-driven prose.

### Chapters

| Chapter | Name | Trigger |
|---------|------|---------|
| I | The Eagle Awakens | Turn 1 |
| II | The Advance Begins | 4 territories |
| III | The Tide of Conquest | 7 territories |
| IV | The Imperial Zenith | 10 territories |
| V | The Final Reckoning | 13 territories |

### Story Events (17 total)

**Campaign events** (trigger on turns & territory count):
`eagle_awakens`, `first_blood`, `continental_blockade`, `the_violet_ink`,
`the_spanish_ulcer`, `the_winter_road`, `the_final_gambit`

**Character arc events** (trigger on relationships & glory):
`murats_peacock_morning`, `murats_betrayal`, `talleyrands_warning`,
`the_unopened_letter`, `the_rose_garden`, `josephines_truth`,
`neys_last_charge`, `berthiers_silence`, `the_emperors_ledger`,
`the_map_and_the_man`

### Personalised Endings

The win screen assembles a unique ending from:
- **Story path breadcrumbs** — which choices the player made throughout
- **Marshal loyalty & glory states** — individual beat cards for each marshal
- **Territory count & turn count** — campaign statistics
- **Chapter-appropriate prose** — valedictory, introspective, or triumphant

---

## Marshal System

Five marshals track `loyalty` (0–100) and `glory` (0–∞) throughout the campaign:

| Marshal | Title | Starting Loyalty | Emoji |
|---------|-------|:----------------:|:-----:|
| Murat | King of Naples | 80 | 🐎 |
| Ney | Prince of the Moskva | 90 | 🗡 |
| Berthier | Chief of Staff | 75 | 📜 |
| Talleyrand | Foreign Minister | 55 | 🕯 |
| Josephine | Empress | 70 | 💌 |

### Status Tiers

| Loyalty | Status | Effect |
|---------|--------|--------|
| Dead | Fallen | Removed from gameplay |
| Glory ≥ 40 | Legend | Gold text + unique win prose |
| Loyalty ≥ 75 | Loyal | Positive conquest reactions |
| Loyalty ≥ 45 | Wavering | Neutral/cautious reactions |
| Loyalty < 45 | Hostile | Negative reactions, defection risk |

Marshal states are visible in the sidebar and affect:
- Conquest modal reactions (territory-specific marshal voice lines)
- Story event triggers (e.g., Talleyrand's warning fires when Ney's glory ≥ 25)
- The personalised win screen (individual beat cards per marshal)

---

## UI & Screens

### Cinematic Modals

| Screen | Purpose |
|--------|---------|
| **Story Modal** | Narrative events with 2–3 branching choices, consequence feedback |
| **Battle Modal** | Force commitment, marshal abilities, victory probability |
| **Conquest Result** | Territory-specific atmosphere prose, resource gains, marshal reactions |
| **Defeat Modal** | Context-sensitive narrative for failed offensives |
| **Chapter Transition** | Full-screen cinematic overlay between campaign phases |
| **Personalised Win Screen** | Dynamic ending with marshal beat cards and campaign summary |

### Design System

- **Fonts:** Cinzel (headings), IM Fell English (prose), Crimson Text (body)
- **Palette:** Gold (#e9c176), Imperial Red (#7b1f1f), Parchment (#d4b97a)
- **Effects:** Glassmorphism, backdrop blur, subtle glow animations
- **Aesthetic:** Dark Napoleonic theme with gold accents throughout

---

## Responsive Design

The game scales across screen sizes with three breakpoints:

| Breakpoint | Width | Behaviour |
|------------|-------|-----------|
| Mobile | ≤ 768px | Sidebars collapse, mobile action bar, full-width modals |
| Tablet | 769–1024px | Narrower sidebars, modals constrained to 520–580px |
| Desktop | 1025–1399px | Default layout with dual sidebars |
| Large | 1400px+ | Wider modals (680–720px), larger text, expanded sidebars |

---

## Known Bugs Fixed (from original submission)

| File | Bug | Fix |
|------|-----|-----|
| `decision_engine.py` | `return` on its own line before the list — always returned `None` | Moved `return` to same line as value |
| `game_engine.py` | `choices()` method called in `app.py` but didn't exist | Added method, wired to `DecisionEngine` |
| `game_engine.py` | No resource tracking (army/gold/morale) | Full resource state with `STARTING_*` constants |
| `map_data.py` | Only 7 countries; frontend has 15 | Expanded to all 15 territories matching frontend |
| Missing | `bfs.py` didn't exist at all | Created with BFS + `bfs_reachable_from_controlled` |
| `story.js` | Unescaped apostrophe in choice label caused JS parse error | Removed contraction in Talleyrand's Warning event |
| `modals.css` | Story/conquest modal text too small to read | Comprehensive font size increase across all modals |

---

## License

This project was developed for the Design & Analysis of Algorithms (DAA)
course at Graphic Era University, Dehradun.

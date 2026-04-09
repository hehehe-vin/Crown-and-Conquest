# Crown & Conquest — Project Architecture

**Project:** Crown & Conquest — DAA-IV-T241  
**Team:** Algorithmic Empire · Graphic Era University  
**Description:** A narrative-driven strategy game where you play as Napoleon Bonaparte, conquering Europe one territory at a time — powered by graph algorithms.

---

## Table of Contents

1. [Quick Overview](#quick-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [System Architecture](#system-architecture)
5. [Component Details](#component-details)
6. [Data Flow](#data-flow)
7. [Graph Algorithms](#graph-algorithms)
8. [Game Mechanics](#game-mechanics)
9. [Frontend-Backend Communication](#frontend-backend-communication)
10. [Database Schema](#database-schema)

---

## Quick Overview

**Crown & Conquest** is a web-based strategy game built with:
- **Backend:** Python + Flask (REST API)
- **Frontend:** Vanilla JavaScript + HTML5 Canvas/SVG
- **Data:** SQLite database for user accounts and game saves
- **Core Features:** Graph-based conquest simulation, battle mechanics, narrative story system, and algorithm visualization

The game flows through turns where players:
1. **Explore** the map using algorithm visualizations (BFS, DFS, Dijkstra)
2. **Attack** adjacent territories in turn-based battles
3. **Manage** resources (army, gold, morale)
4. **Unlock** narrative story events as they conquer new regions
5. **Progress** through 5 chapters with 17 unique events

---

## Technology Stack

### Backend
| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Framework** | Flask 2.3+ | REST API server, templating, session management |
| **Database** | SQLite3 | User accounts, game saves, persistent data |
| **Security** | bcrypt 4.0+ | Password hashing, secure authentication |
| **Network** | Flask-CORS 4.0+ | Cross-Origin Resource Sharing for frontend |
| **HTTP Client** | requests 2.28+ | Downloading assets (map, fonts) |

### Frontend
| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Rendering** | HTML5 Canvas/SVG | Interactive map visualization |
| **Interactivity** | Vanilla JavaScript | Game logic, UI state management |
| **Styling** | CSS3 | Responsive layout, animations, theming |
| **Fonts** | Google Fonts (offline) | Cinzel, Crimson Text, Material Symbols |

### Infrastructure
| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Map Data** | Precomputed graph (Python dict) | 15-node Europe adjacency list |
| **Assets** | PNG + Google Fonts | Downloaded once, cached locally |
| **Configuration** | Environment variables | Flask secret key, server settings |

---

## Project Structure

```
Crown and Conquest/
│
├── README.md                           # Project overview & quick start
├── requirements.txt                    # Python dependencies (pip install -r)
├── ARCHITECTURE.md                     # THIS FILE
│
├── backend/
│
│   ├── app.py                          # Flask REST API server
│   │                                   # Routes: auth, save/load, game state, algorithms
│   │
│   ├── game_engine.py                  # Central game controller
│   │                                   # Manages: resources, territories, invasions
│   │
│   ├── map_graph.py                    # Graph wrapper & accessor
│   │                                   # Exposes: neighbors, countries, metadata
│   │
│   ├── war_engine.py                   # Battle simulation engine
│   │                                   # Simulates: combat rolls, victory/defeat
│   │
│   ├── decision_engine.py              # Strategic choice generator
│   │                                   # Provides: context-sensitive actions for player
│   │
│   ├── db.py                           # Database operations
│   │                                   # Functions: user CRUD, game save/load
│   │
│   ├── download_assets.py              # Asset downloader
│   │                                   # Downloads: map.png, Google Fonts (once)
│   │
│   ├── algorithms/
│   │   ├── bfs.py                      # Breadth-First Search — O(V+E)
│   │   ├── dfs.py                      # Depth-First Search — O(V+E)
│   │   └── dijkstra.py                 # Dijkstra Shortest Path — O((V+E)logV)
│   │
│   ├── data/
│   │   └── map_data.py                 # Europe graph + territory metadata
│   │                                   # 15 nodes: Paris, Berlin, Rome, etc.
│   │
│   ├── static/
│   │   ├── css/
│   │   │   ├── base.css                # Design tokens, layout skeleton, reset
│   │   │   ├── map.css                 # SVG map node/edge/label styling
│   │   │   └── modals.css              # Story, battle, overlay modal styles
│   │   │
│   │   ├── js/
│   │   │   ├── game.js                 # App entry point, API bridge, init
│   │   │   ├── data.js                 # Territory data, loot tables, game state
│   │   │   ├── render.js               # SVG rendering, tooltips, UI updates
│   │   │   ├── algorithms.js           # Frontend BFS/DFS/Dijkstra visualizer
│   │   │   ├── battle.js               # Battle UI, marshal abilities, results
│   │   │   ├── auth.js                 # Login/signup UI and state
│   │   │   └── story.js                # Narrative engine, 17 events, 5 chapters
│   │   │
│   │   ├── fonts/
│   │   │   └── [Downloaded Google Fonts]
│   │   │
│   │   └── map.png                     # Napoleonic Europe map background
│   │
│   ├── templates/
│   │   └── index.html                  # Single HTML page (all frontend)
│   │
│   ├── crown_conquest.db               # SQLite database (created on first run)
│   └── (other .db-wal files)           # Database journal/WAL files
```

---

## System Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Browser)                        │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │  index.html (Single Page)                                    │ │
│ │  ├─ SVG Map Canvas (render.js)                               │ │
│ │  ├─ Story Modals (story.js)                                  │ │
│ │  ├─ Battle UI (battle.js)                                    │ │
│ │  ├─ Algorithm Visualizer (algorithms.js)                     │ │
│ │  ├─ Auth UI (auth.js)                                        │ │
│ │  └─ Sidebar & Controls (game.js)                             │ │
│ │                                                               │ │
│ │  State Object (res): { army, gold, morale, turn, ... }       │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                            ↕ HTTP/JSON                            │
└─────────────────────────────────────────────────────────────────┘
         ↓ (REST API Calls)               ↑ (JSON Responses)
┌─────────────────────────────────────────────────────────────────┐
│                BACKEND (Flask Server - app.py)                   │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │  REST API Routes                                             │ │
│ │  ├─ /api/auth/* (Login/Signup)                              │ │
│ │  ├─ /api/state (Current game state)                         │ │
│ │  ├─ /api/resources (Army, gold, morale)                     │ │
│ │  ├─ /api/controlled (Owned territories)                     │ │
│ │  ├─ /api/invade (Attack territory)                          │ │
│ │  ├─ /api/algorithm/* (BFS/DFS/Dijkstra)                    │ │
│ │  ├─ /api/choices (Strategic actions)                        │ │
│ │  ├─ /api/turn (End turn logic)                              │ │
│ │  ├─ /api/sync (State push from frontend)                    │ │
│ │  └─ /api/save, /api/load (Persistence)                     │ │
│ │                                                               │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                            ↓                                       │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │  GameEngine (game_engine.py)                                 │ │
│ │  └─ Central controller wiring everything together            │ │
│ │     ├─ MapGraph (map_graph.py)                               │ │
│ │     ├─ WarEngine (war_engine.py)                             │ │
│ │     ├─ DecisionEngine (decision_engine.py)                   │ │
│ │     ├─ Algorithms (bfs, dfs, dijkstra)                       │ │
│ │     └─ Database (db.py)                                      │ │
│ │                                                               │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                            ↓                                       │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │  Data Layer                                                  │ │
│ │  ├─ MapGraph structure (europe_map from map_data.py)        │ │
│ │  ├─ Territory metadata (territory_meta)                      │ │
│ │  ├─ SQLite Database (user accounts, saves)                   │ │
│ │  └─ Static Assets (map.png, fonts)                           │ │
│ │                                                               │ │
│ └──────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. **Frontend Entry Point: index.html**
- **Role:** Single-page HTML document hosting the entire UI
- **Contains:** 
  - SVG canvas for interactive map
  - Modal overlays for story, battles, modals
  - Input forms for auth
- **Loaded Resources:**
  - CSS files (base.css, map.css, modals.css)
  - JavaScript modules (game.js, render.js, battle.js, etc.)
  - Font files (Cinzel, Crimson, Material Symbols)
  - Background image (map.png)

### 2. **Backend Entry Point: app.py**
- **Role:** Flask REST API server
- **Responsibilities:**
  - Render index.html on GET `/`
  - Handle authentication (signup, login, logout)
  - Manage game state endpoints
  - Handle invasions and turn logic
  - Provide algorithm visualization endpoints
  - Save/load game progress
- **Session Management:** Flask sessions store `user_id` and `username` after login

### 3. **GameEngine (game_engine.py)**
- **Role:** Central orchestrator of all game logic
- **Manages:**
  - `player_position` — current territory
  - `controlled` — set of conquered territories
  - `resources` — army, gold, morale, turn counter
- **Key Methods:**
  - `invade(country)` — attempt conquest, trigger battle
  - `end_turn()` — collect taxes, increment turn
  - `explore_map_bfs/dfs/dijkstra()` — call algorithms
  - `sync_state()` — keep backend in sync with frontend
  - `choices()` — get available strategic actions

### 4. **MapGraph (map_graph.py)**
- **Role:** Graph wrapper around adjacency list data
- **Data:** 15-node Europe graph (Paris, Berlin, Rome, etc.)
- **Metadata:** For each territory:
  - `cost` — invasion cost multiplier
  - `units` — defender strength pool
  - `gold` — reward for conquest
- **Methods:**
  - `get_neighbors(country)` — adjacent territories
  - `get_countries()` — all territory names
  - `get_meta(country)` — territory metadata

### 5. **WarEngine (war_engine.py)**
- **Role:** Deterministic but random battle simulator
- **Battle Simulation:**
  - Attacker roll: `attacker_strength + random(0,5)`
  - Defender roll: `defender_strength + random(0,5)`
  - Attacker wins if roll is higher
- **Returns:** Battle result, both powers, margin of victory

### 6. **DecisionEngine (decision_engine.py)**
- **Role:** Context-aware action generator
- **Provides Choices:**
  - "Reinforce the Army" — spend gold → gain troops
  - "Rally the Troops" — spend gold → restore morale (when morale < 60)
  - "Press the Advance" — invade adjacent territory
- **Decision Logic:** Choices vary based on current resources

### 7. **Database (db.py)**
- **Tables:**
  - `users` → id, username, pw_hash, created_at
  - `saves` → id, user_id, save_data, updated_at
- **Key Functions:**
  - `create_user()` — register new account
  - `verify_user()` — password check (bcrypt)
  - `save_game()` — persist game state to JSON
  - `load_game()` — restore previous game

### 8. **Algorithms (bfs.py, dfs.py, dijkstra.py)**
- **Purpose:** Pathfinding and graph traversal visualization
- **Endpoints:**
  - `GET /api/algorithm/bfs` — explore neighbors (O(V+E))
  - `GET /api/algorithm/dfs` — depth exploration (O(V+E))
  - `GET /api/algorithm/dijkstra` — shortest paths (O((V+E)logV))
- **Outputs:** Visited order, distances, parents for visualization

### 9. **Frontend JavaScript Modules**

#### game.js
- API bridge to Flask
- App initialization
- Sidebar command setup
- Auth integration

#### render.js
- SVG map rendering
- Territory highlighting
- Node/edge visualization
- Tooltip generation

#### data.js
- Territory data constants
- Loot tables
- Game state object (`res`)
- Marshal definitions

#### battle.js
- Battle modal UI
- Marshal ability display
- Combat result display
- Victory/defeat messaging

#### story.js
- Narrative engine
- Event triggers (17 unique events, 5 chapters)
- Modal story sequences
- Character dialogues

#### algorithms.js
- Frontend algorithm visualization
- Animation loops
- Step-through UI for BFS/DFS/Dijkstra

#### auth.js
- Login/signup form handling
- Session state management
- Account UI

---

## Data Flow

### Game Initialization Flow
```
Browser loads / → Flask routes to index.html
                  ↓
           Frontend loads HTML
                  ↓
           JavaScript (game.js) initializes
                  ↓
           Checks session: /api/auth/me
                  ↓
           If logged in → /api/load (restore save)
                  ↓
           Initialize rendering, state, map
                  ↓
           render.js draws SVG map
                  ↓
           Game ready for player input
```

### Game Turn Flow (Invasion → Update)
```
Player clicks territory to invade
           ↓
battle.js constructs attack UI
           ↓
Display marshal selection modal
           ↓
Player confirms attack
           ↓
POST /api/invade with territory name
           ↓
game_engine.invade(country):
  - Validate territory reachable
  - Deduct invasion cost
  - Calculate attacker/defender strength
  - war_engine.simulate_battle()
  - Update controlled territories
  - Trigger story event if applicable
  - Return battle result
           ↓
Backend returns: { result, battle, resources, controlled, message }
           ↓
Frontend updates:
  - Refresh UI with new resources
  - Trigger story event modals
  - Sync backend via /api/sync
  - render.js redraws map
           ↓
Turn complete, player ready for next action
```

### State Synchronization
```
Frontend state (res) changes → syncBackend()
                               ↓
POST /api/sync with full state
{army, gold, morale, turn, controlled}
                               ↓
backend: game.sync_state() validates & stores
                               ↓
Response: {synced: true, resources, controlled}
                               ↓
Frontend validated — backend and frontend in sync
```

### Save/Load Flow
```
Player clicks "Save Game"
           ↓
Collect full game state (res, controlled, marshals, progress)
           ↓
POST /api/save with state JSON
           ↓
db.save_game(): 
  - Serialize state to JSON
  - Store in saves table (overwrite if exists)
  - Update updated_at timestamp
           ↓
Response: {ok: true}
           ↓

Player reopens game / logs in again
           ↓
Frontend detects session valid
           ↓
GET /api/load
           ↓
db.load_game():
  - Fetch save_data from database
  - Parse JSON
  - Return full state
           ↓
Frontend restores state, re-renders map
           ↓
Game resumable from exactly where player left off
```

---

## Graph Algorithms

### Europe Map Graph
- **Type:** Undirected weighted graph (15 nodes)
- **Nodes:** European territories (Paris, Berlin, Rome, Madrid, etc.)
- **Edges:** Adjacent territories can be invaded
- **Representation:** Python dictionary (adjacency list)

```python
europe_map = {
    "Paris":   ["London", "Berlin", "Rome"],
    "Berlin":  ["Paris", "Moscow", "Warsaw"],
    "Rome":    ["Paris", "Athens", "Cairo"],
    # ... 12 more territories
}
```

### Breadth-First Search (BFS)
- **Purpose:** Explore map layer by layer from current location
- **Time:** O(V + E)
- **Use Case:** Find all territories reachable within N steps
- **Endpoint:** `GET /api/algorithm/bfs`

### Depth-First Search (DFS)
- **Purpose:** Deep exploration along single path
- **Time:** O(V + E)
- **Use Case:** Detect connected components, cycle detection
- **Endpoint:** `GET /api/algorithm/dfs`

### Dijkstra's Shortest Path
- **Purpose:** Find shortest path to all territories from current position
- **Time:** O((V + E) log V)
- **Use Case:** Optimal invasion route planning
- **Endpoint:** `GET /api/algorithm/dijkstra`

### Special: BFS from Controlled Territories
- **Function:** `bfs_reachable_from_controlled()`
- **Purpose:** Find all territories adjacent to ANY controlled territory
- **Use Case:** Determine valid invasion targets

---

## Game Mechanics

### Resource System
| Resource | Starting | Use | Gain |
|----------|----------|-----|------|
| **Army** | 30,000 | Invasion battles (strength = army/1000) | None (static until reinforced) |
| **Gold** | 600 | Invasion costs (50 × territory cost) | Conquest rewards + taxes/turn |
| **Morale** | 85 | Battle effectiveness multiplier (0.7 + morale/100 × 0.6) | +5 on victory, -10 on defeat |
| **Turn** | 1 | Strategy turn counter | +1 each end_turn() |

### Invasion Mechanics
```
Player pays: territory_cost × 50 gold
         ↓
Attacker strength = (army × morale_multiplier) / 1000
Defender strength = territory_units / 500
         ↓
Simulate battle:
  - atk_roll = attacker_strength + rand(0,5)
  - def_roll = defender_strength + rand(0,5)
  - attacker wins if atk_roll > def_roll
         ↓
Victory: territory added to controlled, gold reward, +5 morale
Defeat: refund 50% of invasion cost, -10 morale
```

### Territory Metadata
```python
territory_meta = {
    "Paris": {
        "cost": 1,          # invasion cost multiplier
        "units": 5000,      # defender troop pool
        "gold": 100,        # conquest reward
        "loot": ["Artwork", "Wine"],  # optional rewards
    },
    # ... all 15 territories
}
```

### Turn Progression
```
Player action (invade, reinforce, rally) → resources update
         ↓
Player clicks "End Turn"
         ↓
Tax collection: n_cities × 100 gold
         ↓
Turn counter incremented
         ↓
Resources updated
         ↓
Story events may trigger based on:
  - Territories controlled
  - Resources remaining
  - Turn count
         ↓
New turn ready
```

### Story System
- **17 Unique Events** across 5 chapters
- **Triggers:** Territory conquest, resource milestones, turn count
- **Mechanics:**
  - Modal overlay with narrative text
  - Optional choices affecting morale/resources
  - Character portraits and dialogue
- **Location:** story.js event definitions

---

## Frontend-Backend Communication

### Key API Endpoints

| Method | Endpoint | Purpose | Returns |
|--------|----------|---------|---------|
| GET | `/` | Render game UI | index.html |
| POST | `/api/auth/signup` | Create account | {ok, user_id, username} |
| POST | `/api/auth/login` | Authenticate | {ok, username, hasSave} |
| POST | `/api/auth/logout` | Clear session | {ok} |
| GET | `/api/auth/me` | Check session | {ok, username, hasSave} |
| GET | `/api/state` | Full game state | {territory, resources, controlled} |
| GET | `/api/resources` | Resources only | {army, gold, morale, turn} |
| GET | `/api/controlled` | Conquered territories | list of territory names |
| POST | `/api/invade` | Attempt conquest | {result, battle, resources, controlled} |
| GET | `/api/algorithm/bfs` | BFS visualization | {visited, distances, parents} |
| GET | `/api/algorithm/dfs` | DFS visualization | {visited, distances, parents} |
| GET | `/api/algorithm/dijkstra` | Dijkstra visualization | {visited, distances, parents} |
| GET | `/api/choices` | Strategic actions | [{action, label, description}] |
| POST | `/api/turn` | End turn, collect taxes | {turn, tax, resources} |
| POST | `/api/sync` | Push state to backend | {synced, resources, controlled} |
| POST | `/api/save` | Save game progress | {ok} |
| GET | `/api/load` | Load saved game | {ok, save_data} |
| DELETE | `/api/save` | Delete save file | {ok} |

### Request/Response Flow Example: Invasion

**Request:**
```javascript
POST /api/invade
Content-Type: application/json

{ "country": "Berlin" }
```

**Backend Processing:**
```python
# Validate
✓ Territory exists
✓ Not already controlled
✓ Adjacent to controlled territory
✓ Sufficient gold

# Execute
- Deduct gold cost
- Calculate strengths (using morale multiplier)
- Simulate battle (random rolls)
- Update resources & controlled set
- Trigger story events
```

**Response:**
```json
{
  "result": "Victory",
  "message": "Victory! Berlin falls to the Grande Armée. (+150 gold)",
  "country": "Berlin",
  "battle": {
    "result": "Victory",
    "attack_power": 32,
    "defense_power": 28,
    "margin": 4
  },
  "resources": {
    "army": 30000,
    "gold": 450,
    "morale": 90,
    "turn": 1
  },
  "controlled": ["Paris", "Berlin"]
}
```

### Authentication Flow
```
Signup:
  1. User enters username & password
  2. POST /api/auth/signup
  3. Backend bcrypt hashes password
  4. Creates user record
  5. Sets session["user_id"]
  6. Frontend stores username

Login:
  1. User enters credentials
  2. POST /api/auth/login
  3. Backend verifies bcrypt hash
  4. Sets session["user_id"]
  5. Returns if save exists (hasSave)
  6. Frontend loads save if available

Logout:
  1. User clicks logout
  2. POST /api/auth/logout
  3. Backend clears session
  4. Frontend clears UI state
```

---

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pw_hash    TEXT NOT NULL,                    -- bcrypt hash
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Saves Table
```sql
CREATE TABLE saves (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  save_data  TEXT NOT NULL,                    -- Full game state as JSON
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id)                              -- One save per user
);
```

### Save Data Structure (JSON)
```json
{
  "player_position": "Paris",
  "controlled": ["Paris", "Berlin", "Rome"],
  "resources": {
    "army": 28000,
    "gold": 850,
    "morale": 92,
    "turn": 5
  },
  "marshals": [
    { "name": "Marshal Bernadotte", "ability": "flanking" }
  ],
  "progress": {
    "chapter": 2,
    "events_seen": [1, 2, 5, 8],
    "loot_collected": ["Artwork", "Wine"]
  }
}
```

---

## Startup Sequence

### First Run
```
1. python -m pip install -r requirements.txt  (dependencies)
2. cd backend
3. python download_assets.py                  (fetch map + fonts, save locally)
4. python app.py                              (start Flask server)
5. Browser → http://127.0.0.1:5000           (load game)
```

### Subsequent Runs
```
1. python app.py                              (start Flask server)
2. Browser → http://127.0.0.1:5000           (load game)
   (All assets already cached locally)
```

### Frontend Initialization
```
1. index.html loaded
2. CSS files parsed (base, map, modals)
3. JavaScript modules loaded
4. game.js runs: API bridge setup, sync check
5. render.js: SVG map rendering
6. auth.js: Check if logged in (GET /api/auth/me)
7. If logged in: Load saved game (GET /api/load)
8. Otherwise: Show login/signup screen
```

---

## Performance Characteristics

| Operation | Complexity | Typical Time |
|-----------|-----------|--------------|
| BFS traversal | O(V + E) | ~5ms (15 nodes) |
| DFS traversal | O(V + E) | ~5ms (15 nodes) |
| Dijkstra's algorithm | O((V+E)logV) | ~20ms (15 nodes) |
| Battle simulation | O(1) | <1ms (2 random rolls) |
| Game state save | O(1) | ~10ms (JSON serialize to DB) |
| Game state load | O(1) | ~5ms (JSON deserialize from DB) |
| Map rendering (SVG) | O(V + E) | ~50ms (first render) |
| Modal display | O(1) | <5ms (DOM manipulation) |

---

## Key Design Decisions

### 1. **Frontend Authority for Rich State**
- Frontend maintains marshals, loot collection, commit fraction
- Backend stays focused on core game mechanics
- `/sync` endpoint keeps backend informed of truth state

### 2. **Offline-First Assets**
- Assets downloaded once and cached locally
- Game fully playable without network after first run
- Reduces latency, improves reliability

### 3. **Graph-Centric Game Design**
- Territory adjacency enforced via graph structure
- Algorithms visualized to teach DAA concepts
- Natural fit for DSA course project

### 4. **SQLite for Persistence**
- Single-file database (no external services)
- WAL mode for concurrent access
- Foreign keys enabled for referential integrity
- Suitable for small-scale multiplayer scenarios

### 5. **Single-Page Application (SPA)**
- All UI in index.html
- JavaScript handles routing and state
- Reduces server load, improves responsiveness
- API-first backend design

### 6. **Session-Based Authentication**
- Flask sessions store user_id
- Secure cookie with SECRET_KEY
- All subsequent API calls authenticated via session

---

## Common Workflows

### "I want to add a new territory"
1. Edit `backend/data/map_data.py`: Add to `europe_map` & `territory_meta`
2. Edit `backend/static/data.js`: Add to frontend territory definitions
3. Edit `backend/static/templates/index.html`: Add SVG node for new territory
4. Edit `backend/static/css/map.css`: Add styling for new node

### "I want to add a new algorithm"
1. Create `backend/algorithms/my_algo.py` with algorithm implementation
2. Add endpoint in `backend/app.py`: `@app.route("/api/algorithm/my_algo")`
3. Call from `game_engine.py` if needed
4. Add visualization in `backend/static/js/algorithms.js`

### "I want to add a story event"
1. Define event in `backend/static/js/story.js`: `events[]` array
2. Add trigger condition check
3. Create modal HTML overlay
4. Set event-specific resource changes
5. Link to territory conquest or turn count

### "I want to change game balance"
1. Adjust `GameEngine` constants (STARTING_ARMY, STARTING_GOLD, etc.)
2. Modify `territory_meta` in `backend/data/map_data.py` (costs, rewards)
3. Tweak `battle.js` simulation logic or morale multiplier
4. Test via multiple game playthroughs

---

## Debugging & Development

### Enable Backend Logs
```python
# In app.py, set Flask debug mode:
app.run(debug=True, port=5000)
```

### Frontend Console Debugging
```javascript
// game.js outputs API calls to console
Console → Look for API requests/responses
          Game state (res object)
          Algorithm visualization progress
```

### Database Inspection
```bash
# SQLite CLI
cd backend
sqlite3 crown_conquest.db

# Query examples:
SELECT * FROM users;
SELECT * FROM saves;
SELECT * FROM saves WHERE user_id = 1;
```

### Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| 404 on `/` | Flask not running | `python app.py` from backend/ |
| Map not loading | Static assets missing | `python download_assets.py` |
| Login fails | DB not initialized | Backend auto-initializes on startup |
| Invasions not working | Backend out of sync | Frontend calls `/api/sync` after state change |
| Algorithm endpoints 404 | Routes not registered | Check `app.py` for endpoint definitions |

---

## Future Enhancement Ideas

1. **Multiplayer:** Real-time battles between players (WebSockets)
2. **Leaderboard:** Ranking by conquest speed, resources managed
3. **Difficulty Levels:** AI opponents, scaling enemy strength
4. **Mobile App:** React Native or Flutter wrapper
5. **More Algorithms:** A*, Bellman-Ford for advanced pathfinding
6. **Procedural Generation:** Random map & events per playthrough
7. **Marshal Progression:** Level-up system for military leaders
8. **Diplomacy:** Trade, alliances, betrayals narrative branches
9. **Fog of War:** Hide enemy territories until scouted
10. **Achievements:** Badges for conquest speed, resource efficiency, etc.

---

## Summary

**Crown & Conquest** is a full-stack strategy game demonstrating:
- **Backend:** Python + Flask REST API, database persistence, game logic
- **Frontend:** Vanilla JavaScript, SVG rendering, interactive UI
- **Algorithms:** BFS, DFS, Dijkstra's implemented and visualized
- **Architecture:** Clean separation of concerns, API-driven communication
- **Data Flow:** Frontend-authoritative UI state, backend-authoritative game logic
- **Integration:** Seamless sync between client and server

The project successfully combines educational content (algorithms, data structures) with engaging gameplay (conquest, narrative, strategy), demonstrating real-world full-stack development practices.


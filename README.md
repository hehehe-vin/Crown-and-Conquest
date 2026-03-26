# Crown & Conquest — Integrated Application

An algorithmic strategy game combining the Napoleonic era with data structure visualizations (DFS, Dijkstra, BFS, Greedy algorithms).

## 🏗️ Project Structure

```
Crown-Conquest/
├── backend/
│   ├── app.py                    # Flask web server (combined frontend + backend)
│   ├── game_engine.py            # Core game logic
│   ├── decision_engine.py        # AI decision making
│   ├── war_engine.py             # Battle simulation
│   ├── map_graph.py              # Graph representation of territories
│   ├── templates/
│   │   └── index.html            # Web UI (integrated)
│   ├── algorithms/
│   │   ├── dfs.py                # Depth-First Search
│   │   └── dijkstra.py           # Dijkstra's shortest path
│   └── data/
│       └── map_data.py           # Territory data
├── frontend/
│   └── c&c_s.html                # Original HTML (copy in templates/)
└── requirements.txt              # Python dependencies
```

## 📋 Installation

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the application:**
   ```bash
   cd backend
   python app.py
   ```

3. **Access the game:**
   - Open your browser to `http://localhost:5000`
   - The Flask server will serve both the frontend and API endpoints

## 🎮 Features

- **Interactive Map**: Click territories to explore and conquer
- **Algorithm Visualization**: Watch DFS, Dijkstra, BFS, and Greedy algorithms in action
- **Battle System**: Real-time combat outcomes based on army strength
- **Resource Management**: Manage gold, morale, and army units across campaigns

## 🔌 API Endpoints

- `GET /` — Serves the main game interface
- `GET /countries` — List all territory data
- `GET /explore` — Run exploration algorithm
- `GET /routes` — Calculate optimal routes to territories
- `GET /controlled` — Get player-controlled territories
- `POST /invade/<country>` — Initiate invasion of a territory
- `GET /choices` — Get available strategic choices

## 🛡️ CORS Configuration

CORS is enabled for all routes, allowing the frontend to make requests to the backend API safely.

## 🚀 Development

The application runs in Flask debug mode by default. Modify `app.py`:

```python
if __name__ == "__main__":
    app.run(debug=False)  # Change to False for production
```

---

**Built with**: Flask, SVG Map Graphics, Napoleonic Campaign Theme

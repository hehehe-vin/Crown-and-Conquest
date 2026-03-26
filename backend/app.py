# ─────────────────────────────────────────────────────────────────────────────
# app.py  ·  Crown & Conquest – DAA-IV-T241
# Flask REST API — serves the game frontend and all algorithm endpoints
# ─────────────────────────────────────────────────────────────────────────────

from flask      import Flask, jsonify, render_template, request
from flask_cors import CORS
from game_engine import GameEngine

app  = Flask(__name__, template_folder="templates")
CORS(app)   # Allow the frontend (same or different origin) to call the API

game = GameEngine()


# ── Serve the game UI ────────────────────────────────────────────────────────

@app.route("/")
def home():
    return render_template("index.html")


# ── Graph / map data ─────────────────────────────────────────────────────────

@app.route("/countries")
def countries():
    """All territory names in the graph."""
    return jsonify(game.map.get_countries())


@app.route("/graph")
def graph():
    """Full adjacency list + metadata for every territory."""
    data = {}
    for city in game.map.get_countries():
        data[city] = {
            "neighbors": [{"name": n, "weight": w}
                          for n, w in game.map.get_neighbors(city)],
            "meta": game.map.get_meta(city),
        }
    return jsonify(data)


# ── Algorithm endpoints ───────────────────────────────────────────────────────

@app.route("/explore/bfs")
def explore_bfs():
    """BFS traversal from Paris — returns visit order, levels, parents."""
    return jsonify(game.explore_map_bfs())


@app.route("/explore/dfs")
def explore_dfs():
    """DFS traversal from Paris — returns visit order and parent tree."""
    return jsonify(game.explore_map_dfs())


@app.route("/explore")
def explore():
    """Legacy endpoint — defaults to DFS (backward compat)."""
    return jsonify(game.explore_map_dfs())


@app.route("/routes")
def routes():
    """Dijkstra from Paris — cheapest path + distance to every city."""
    return jsonify(game.best_routes())


@app.route("/routes/<target>")
def route_to(target):
    """Dijkstra shortest path specifically to <target>."""
    result = game.best_routes()
    city   = target.title()          # normalise capitalisation
    if city not in result["distances"]:
        return jsonify({"error": f"Unknown territory: {city}"}), 404
    return jsonify({
        "target":   city,
        "distance": result["distances"][city],
        "path":     result["paths"][city],
    })


@app.route("/reachable")
def reachable():
    """BFS adjacency — territories adjacent to player's empire (legal invasion targets)."""
    return jsonify({
        "controlled": game.get_controlled_territories(),
        "reachable":  game.reachable_targets(),
    })


# ── Decision engine ───────────────────────────────────────────────────────────

@app.route("/choices")
def choices():
    """Strategic choices available to the player right now."""
    return jsonify(game.choices())


# ── Game state ────────────────────────────────────────────────────────────────

@app.route("/state")
def state():
    """Full game state snapshot: resources + controlled territories."""
    return jsonify({
        "resources":  game.get_resources(),
        "controlled": game.get_controlled_territories(),
        "reachable":  game.reachable_targets(),
    })


@app.route("/resources")
def resources():
    """Current player resources (army, gold, morale, turn)."""
    return jsonify(game.get_resources())


@app.route("/controlled")
def controlled():
    """List of territories the player controls."""
    return jsonify(game.get_controlled_territories())


# ── Actions ───────────────────────────────────────────────────────────────────

@app.route("/invade/<country>")
def invade(country):
    """
    Attempt to invade <country>.
    Returns battle result, updated resources, and controlled list.
    """
    result = game.invade(country.title())
    return jsonify(result)


@app.route("/endturn", methods=["POST", "GET"])
def end_turn():
    """Advance turn: collect taxes, apply reinforcements."""
    return jsonify(game.end_turn())


@app.route("/reset", methods=["POST", "GET"])
def reset():
    """Reset the game to initial state."""
    return jsonify(game.reset())


# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 56)
    print("  Crown & Conquest  |  DAA-IV-T241")
    print("  http://127.0.0.1:5000")
    print("=" * 56)
    app.run(debug=True)

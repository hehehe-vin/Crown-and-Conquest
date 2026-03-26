from flask import Flask, jsonify, render_template, request
from flask_cors import CORS
from game_engine import GameEngine

app = Flask(__name__, template_folder='templates')
CORS(app)

game = GameEngine()


@app.route("/")
def home():
    return render_template('index.html')


@app.route("/countries")
def countries():
    return jsonify(game.map.get_countries())


@app.route("/explore")
def explore():
    """DFS traversal from player's current position."""
    return jsonify(game.explore_map())


@app.route("/explore-bfs")
def explore_bfs():
    """BFS traversal from player's current position."""
    return jsonify(game.explore_map_bfs())


@app.route("/routes")
def routes():
    """
    Dijkstra shortest-path costs from player's position to every country.
    Bug fix: dijkstra() now returns (distances, previous); game_engine unpacks
    and returns only the distances dict, so this endpoint stays clean.
    """
    return jsonify(game.best_routes())


@app.route("/best-path/<target>")
def best_path(target):
    """Return the cheapest route to a specific country as an ordered list."""
    path = game.best_path_to(target)
    if not path:
        return jsonify({"error": f"No path found to {target}"}), 404
    return jsonify({"target": target, "path": path})


@app.route("/choices")
def choices():
    """
    Return strategic decision options + greedy recommendation.
    Bug fix: choices() was called in app.py but the method didn't exist
    in GameEngine — this now correctly delegates to DecisionEngine.
    """
    return jsonify(game.choices())


@app.route("/controlled")
def controlled():
    return jsonify(game.get_controlled_territories())


@app.route("/player")
def player():
    return jsonify(game.get_player_state())


@app.route("/resources")
def resources():
    return jsonify(game.get_resources())


@app.route("/gamestate")
def gamestate():
    return jsonify(game.get_game_state())


@app.route("/advance-turn", methods=["POST"])
def advance_turn():
    return jsonify(game.advance_turn())


@app.route("/update-resources", methods=["POST"])
def update_resources():
    data = request.get_json() or {}
    updated = game.update_resources(
        gold=data.get("gold", 0),
        soldiers=data.get("soldiers", 0),
        supplies=data.get("supplies", 0),
        alliances=data.get("alliances", 0),
    )
    return jsonify(updated)


@app.route("/invade/<country>")
def invade(country):
    result = game.invade(country)
    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True)

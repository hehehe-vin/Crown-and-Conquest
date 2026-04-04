# ─────────────────────────────────────────────────────────────────────────────
# app.py  ·  Crown & Conquest – DAA-IV-T241
# Flask REST API — serves the game frontend and all algorithm endpoints
# ─────────────────────────────────────────────────────────────────────────────

from flask      import Flask, jsonify, render_template, request
from flask_cors import CORS
from game_engine import GameEngine

app  = Flask(__name__, template_folder="templates")
CORS(app)

game = GameEngine()


# ── UI ───────────────────────────────────────────────────────────────────────

@app.route("/")
def home():
    return render_template("index.html")


# ── Map data ─────────────────────────────────────────────────────────────────

@app.route("/countries")
def countries():
    return jsonify(game.map.get_countries())


@app.route("/graph")
def graph():
    data = {}
    for city in game.map.get_countries():
        data[city] = {
            "neighbors": [{"name": n, "weight": w}
                          for n, w in game.map.get_neighbors(city)],
            "meta": game.map.get_meta(city),
        }
    return jsonify(data)


# ── Algorithms ───────────────────────────────────────────────────────────────

@app.route("/explore/bfs")
def explore_bfs():
    return jsonify(game.explore_map_bfs())


@app.route("/explore/dfs")
def explore_dfs():
    return jsonify(game.explore_map_dfs())


@app.route("/routes")
def routes():
    return jsonify(game.best_routes())


@app.route("/routes/<target>")
def route_to(target):
    result = game.best_routes()
    city   = target.title()
    if city not in result["distances"]:
        return jsonify({"error": f"Unknown territory: {city}"}), 404
    return jsonify({
        "target":   city,
        "distance": result["distances"][city],
        "path":     result["paths"][city],
    })


@app.route("/reachable")
def reachable():
    return jsonify({
        "controlled": game.get_controlled_territories(),
        "reachable":  game.reachable_targets(),
    })


# ── Decision engine ───────────────────────────────────────────────────────────

@app.route("/choices")
def choices():
    return jsonify(game.choices())


# ── Game state ────────────────────────────────────────────────────────────────

@app.route("/state")
def state():
    return jsonify({
        "resources":  game.get_resources(),
        "controlled": game.get_controlled_territories(),
        "reachable":  game.reachable_targets(),
    })


@app.route("/resources")
def resources():
    return jsonify(game.get_resources())


@app.route("/controlled")
def controlled():
    return jsonify(game.get_controlled_territories())


# ── Actions ───────────────────────────────────────────────────────────────────

@app.route("/invade/<country>")
def invade(country):
    return jsonify(game.invade(country.title()))


@app.route("/endturn", methods=["POST", "GET"])
def end_turn():
    return jsonify(game.end_turn())


@app.route("/reset", methods=["POST", "GET"])
def reset():
    game._reset_state()
    return jsonify(game.reset())


# ── Sync — frontend pushes authoritative state to backend ────────────────────
# Called after every state-changing action so /state always reflects reality.
# Body: { army, gold, morale, turn, controlled: [...] }

@app.route("/sync", methods=["POST"])
def sync():
    data       = request.get_json(force=True, silent=True) or {}
    army       = data.get("army",       0)
    gold       = data.get("gold",       0)
    morale     = data.get("morale",     85)
    turn       = data.get("turn",       1)
    controlled = data.get("controlled", ["Paris"])
    return jsonify(game.sync_state(army, gold, morale, turn, controlled))


# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 56)
    print("  Crown & Conquest  |  DAA-IV-T241")
    print("  http://127.0.0.1:5000")
    print("=" * 56)
    app.run(debug=True)

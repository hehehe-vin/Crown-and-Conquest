# ─────────────────────────────────────────────────────────────────────────────
# app.py  ·  Crown & Conquest – DAA-IV-T241
# Flask REST API — serves the game frontend and all algorithm endpoints
# ─────────────────────────────────────────────────────────────────────────────

from flask      import Flask, jsonify, render_template, request, session
from flask_cors import CORS
from game_engine import GameEngine
from db import init_db, create_user, verify_user, save_game, load_game, delete_save, has_save
import os

app  = Flask(__name__, template_folder="templates")
app.secret_key = os.environ.get("SECRET_KEY", "crown-conquest-daa-iv-t241-secret-key")
CORS(app, supports_credentials=True)

game = GameEngine()

# Initialise database on startup
init_db()


# ── UI ───────────────────────────────────────────────────────────────────────

@app.route("/")
def home():
    return render_template("index.html")


# ── Authentication ───────────────────────────────────────────────────────────

@app.route("/api/auth/signup", methods=["POST"])
def auth_signup():
    data = request.get_json(force=True, silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    result = create_user(username, password)
    if result["ok"]:
        session["user_id"]  = result["user_id"]
        session["username"] = username
        return jsonify({"ok": True, "username": username})
    else:
        return jsonify(result), 400


@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    data = request.get_json(force=True, silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    result = verify_user(username, password)
    if result["ok"]:
        session["user_id"]  = result["user_id"]
        session["username"] = result["username"]
        has = has_save(result["user_id"])
        return jsonify({"ok": True, "username": result["username"], "hasSave": has})
    else:
        return jsonify(result), 401


@app.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    session.clear()
    return jsonify({"ok": True})


@app.route("/api/auth/me")
def auth_me():
    if "user_id" in session:
        has = has_save(session["user_id"])
        return jsonify({
            "ok": True,
            "username": session.get("username"),
            "hasSave": has,
        })
    return jsonify({"ok": False})


# ── Save / Load ──────────────────────────────────────────────────────────────

@app.route("/api/save", methods=["POST"])
def api_save():
    if "user_id" not in session:
        return jsonify({"ok": False, "error": "Not logged in."}), 401
    data = request.get_json(force=True, silent=True) or {}
    result = save_game(session["user_id"], data)
    return jsonify(result)


@app.route("/api/load")
def api_load():
    if "user_id" not in session:
        return jsonify({"ok": False, "error": "Not logged in."}), 401
    result = load_game(session["user_id"])
    return jsonify(result)


@app.route("/api/save", methods=["DELETE"])
def api_delete_save():
    if "user_id" not in session:
        return jsonify({"ok": False, "error": "Not logged in."}), 401
    result = delete_save(session["user_id"])
    return jsonify(result)


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

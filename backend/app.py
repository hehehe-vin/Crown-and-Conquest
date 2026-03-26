from flask import Flask, jsonify, render_template
from flask_cors import CORS
from game_engine import GameEngine

app = Flask(__name__, template_folder='templates')
CORS(app)  # Enable CORS for all routes

game = GameEngine()

@app.route("/")
def home():
    return render_template('index.html')


@app.route("/countries")
def countries():
    return jsonify(game.map.get_countries())


@app.route("/explore")
def explore():
    return jsonify(game.explore_map())


@app.route("/routes")
def routes():
    return jsonify(game.best_routes())


@app.route("/choices")
def choices():
    return jsonify(game.choices())


@app.route("/controlled")
def controlled():
    return jsonify(game.get_controlled_territories())


@app.route("/invade/<country>")
def invade(country):
    result = game.invade(country)
    return jsonify({
        "country": country,
        "result": result
    })


if __name__ == "__main__":
    app.run(debug=True)
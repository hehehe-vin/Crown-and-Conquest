from map_graph import MapGraph
from dfs import dfs
from dijkstra import dijkstra, reconstruct_path
from bfs import bfs
from decision_engine import DecisionEngine
from war_engine import WarEngine


class GameEngine:

    def __init__(self):
        self.map = MapGraph()
        self.decision = DecisionEngine()
        self.player_position = "Paris"          # aligned with new map_data
        self.controlled = {"Paris"}
        self.war = WarEngine()

        # Player state
        self.player = {
            "name": "Player One",
            "health": 100,
            "morale": 75,
            "level": 1,
        }

        # Resources
        self.resources = {
            "gold": 5000,
            "soldiers": 500,
            "supplies": 200,
            "alliances": 0,
        }

        # Game state
        self.game_state = {
            "turn": 1,
            "phase": "planning",   # planning → action → resolution
            "status": "active",
            "total_territories": 15,
            "conquered": 1,        # Paris starts controlled
        }

    # ── Algorithm wrappers ────────────────────────────────────

    def explore_map(self):
        """DFS traversal from the player's current position."""
        return dfs(self.map, self.player_position)

    def explore_map_bfs(self):
        """BFS traversal from the player's current position."""
        return bfs(self.map, self.player_position)

    def best_routes(self):
        """
        Dijkstra shortest paths from current position.
        Returns a dict of {country: cost} for easy JSON serialisation.
        Bug fix: dijkstra() now returns (distances, previous); unpack both.
        """
        distances, previous = dijkstra(self.map, self.player_position)
        return distances   # previous is used internally for path reconstruction

    def best_path_to(self, target):
        """Return the cheapest route (list of countries) to a specific target."""
        _, previous = dijkstra(self.map, self.player_position)
        return reconstruct_path(previous, target)

    # ── State getters ─────────────────────────────────────────

    def get_controlled_territories(self):
        return list(self.controlled)

    def get_player_state(self):
        return self.player

    def get_resources(self):
        return self.resources

    def get_game_state(self):
        return {
            **self.game_state,
            "territories_held": len(self.controlled),
            "territories_remaining": self.game_state["total_territories"] - len(self.controlled),
        }

    # ── Choices / Decision engine ─────────────────────────────

    def choices(self):
        """
        Return available strategic decisions.
        Bug fix: was missing from GameEngine entirely — app.py called it but it didn't exist.
        Also wires in the DecisionEngine's greedy recommendation.
        """
        options = self.decision.get_choices()
        recommendation = self.decision.evaluate_strategy(
            self.resources, len(self.controlled)
        )
        return {
            "options": options,
            "recommended": recommendation,
        }

    # ── Resource management ───────────────────────────────────

    def update_resources(self, gold=0, soldiers=0, supplies=0, alliances=0):
        self.resources["gold"]      = max(0, self.resources["gold"]      + gold)
        self.resources["soldiers"]  = max(0, self.resources["soldiers"]  + soldiers)
        self.resources["supplies"]  = max(0, self.resources["supplies"]  + supplies)
        self.resources["alliances"] = max(0, self.resources["alliances"] + alliances)
        return self.resources

    # ── Turn management ───────────────────────────────────────

    def advance_turn(self):
        """Advance one turn: increment counter, regenerate resources, cycle phase."""
        self.game_state["turn"] += 1
        self.update_resources(gold=200, supplies=50)
        phases = ["planning", "action", "resolution"]
        idx = phases.index(self.game_state["phase"])
        self.game_state["phase"] = phases[(idx + 1) % len(phases)]
        return self.game_state

    # ── Conquest ─────────────────────────────────────────────

    def capture_country(self, country):
        if country not in self.controlled:
            self.controlled.add(country)
            self.game_state["conquered"] += 1
            return True
        return False

    def invade(self, country):
        if country in self.controlled:
            return {"status": "Already controlled", "success": False}

        if self.resources["soldiers"] < 100:
            return {"status": "Not enough soldiers", "success": False}

        # Check adjacency — can only invade a neighbour of controlled territory
        reachable_neighbors = set()
        for c in self.controlled:
            for neighbor, _ in self.map.get_neighbors(c):
                reachable_neighbors.add(neighbor)

        if country not in reachable_neighbors:
            return {"status": "Not adjacent to your territory", "success": False}

        attacker = 10
        defender = 7
        result = self.war.simulate_battle(attacker, defender)

        if result == "Victory":
            self.controlled.add(country)
            self.game_state["conquered"] += 1
            self.update_resources(soldiers=-100, gold=-500, supplies=-50)
            return {"status": "Victory", "success": True, "country": country}

        return {"status": result, "success": False}

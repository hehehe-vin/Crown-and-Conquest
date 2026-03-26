# ─────────────────────────────────────────────────────────────────────────────
# game_engine.py  ·  Crown & Conquest – DAA-IV-T241
# Central game controller — wires together all subsystems
# ─────────────────────────────────────────────────────────────────────────────

from map_graph       import MapGraph
from algorithms.bfs  import bfs, bfs_reachable_from_controlled
from algorithms.dfs  import dfs
from algorithms.dijkstra import dijkstra
from decision_engine import DecisionEngine
from war_engine      import WarEngine


class GameEngine:

    # ── Starting resources (match the frontend defaults) ──────────────────
    STARTING_ARMY  = 50_000
    STARTING_GOLD  = 1_200
    STARTING_MORALE = 85

    def __init__(self):
        self.map        = MapGraph()
        self.decision   = DecisionEngine()
        self.war        = WarEngine()

        # Player state
        self.player_position = "Paris"
        self.controlled      = {"Paris"}
        self.resources = {
            "army":   self.STARTING_ARMY,
            "gold":   self.STARTING_GOLD,
            "morale": self.STARTING_MORALE,
            "turn":   1,
        }

    # ── Resource helpers ──────────────────────────────────────────────────

    def get_resources(self) -> dict:
        return dict(self.resources)

    def get_controlled_territories(self) -> list:
        return list(self.controlled)

    # ── Algorithm endpoints ───────────────────────────────────────────────

    def explore_map_bfs(self) -> dict:
        """BFS from player's starting capital."""
        return bfs(self.map, self.player_position)

    def explore_map_dfs(self) -> dict:
        """DFS from player's starting capital."""
        return dfs(self.map, self.player_position)

    def best_routes(self) -> dict:
        """Dijkstra from player's starting capital — cheapest path to every city."""
        result = dijkstra(self.map, self.player_position)
        # Convert inf to None so it serialises cleanly to JSON
        result["distances"] = {
            k: (v if v != float("inf") else None)
            for k, v in result["distances"].items()
        }
        return result

    def reachable_targets(self) -> list:
        """BFS adjacency check — which unconquered territories can be invaded right now?"""
        return bfs_reachable_from_controlled(self.map, self.controlled)

    # ── Decision engine ───────────────────────────────────────────────────

    def choices(self) -> list:                      # ← was MISSING in original
        """Return context-sensitive strategic choices."""
        return self.decision.get_choices(
            controlled=list(self.controlled),
            resources=self.resources,
        )

    # ── Conquest / invasion ───────────────────────────────────────────────

    def invade(self, country: str) -> dict:
        """
        Attempt to invade `country`.
        Validates legality, simulates battle, updates state, returns full report.
        """
        if country not in self.map.get_countries():
            return {"result": "Error", "message": f"Unknown territory: {country}"}

        if country in self.controlled:
            return {"result": "Error", "message": f"{country} is already under Imperial control."}

        # Must be adjacent to a controlled territory
        reachable = self.reachable_targets()
        if country not in reachable:
            return {"result": "Error", "message": f"{country} is not adjacent to your territory."}

        meta          = self.map.get_meta(country)
        gold_cost     = meta["cost"] * 50
        army_cost     = meta["cost"] * 500
        gold_reward   = meta["gold"]

        # Resource check
        if self.resources["gold"] < gold_cost:
            return {"result": "Error", "message": f"Insufficient gold. Need {gold_cost}g."}
        if self.resources["army"] < army_cost:
            return {"result": "Error", "message": f"Insufficient army. Need {army_cost} troops."}

        # Deduct cost
        self.resources["gold"]  -= gold_cost
        self.resources["army"]  -= army_cost

        # Simulate battle
        attacker_str = max(1, self.resources["army"] // 1000)
        defender_str = meta["units"] // 500
        battle       = self.war.simulate_battle(attacker_str, defender_str)

        if battle["result"] == "Victory":
            self.controlled.add(country)
            self.resources["gold"]   += gold_reward
            self.resources["morale"]  = min(100, self.resources["morale"] + 2)
            message = f"Victory! {country} falls to the Grande Armée. (+{gold_reward} gold)"
        else:
            # Partial refund on defeat
            self.resources["army"]  += army_cost // 2
            self.resources["morale"] = max(0, self.resources["morale"] - 10)
            message = f"Defeat! The offensive on {country} was repelled."

        return {
            "result":        battle["result"],
            "message":       message,
            "country":       country,
            "battle_detail": battle,
            "resources":     self.get_resources(),
            "controlled":    self.get_controlled_territories(),
        }

    def end_turn(self) -> dict:
        """Advance the turn counter, collect tax, enemy reinforcements."""
        self.resources["turn"] += 1
        n_cities              = len(self.controlled)
        tax                   = n_cities * 100
        self.resources["gold"]  += tax
        self.resources["army"]  += 3000

        return {
            "turn":      self.resources["turn"],
            "tax":       tax,
            "resources": self.get_resources(),
        }

    def reset(self) -> dict:
        """Reset the game to its starting state."""
        self.__init__()
        return {"message": "Game reset.", "resources": self.get_resources()}

# ─────────────────────────────────────────────────────────────────────────────
# game_engine.py  ·  Crown & Conquest – DAA-IV-T241
# Central game controller
# ─────────────────────────────────────────────────────────────────────────────

from map_graph        import MapGraph
from decision_engine  import DecisionEngine
from war_engine       import WarEngine
from algorithms.bfs   import bfs, bfs_reachable_from_controlled
from algorithms.dfs   import dfs
from algorithms.dijkstra import dijkstra


class GameEngine:

    STARTING_ARMY   = 30_000   # matches frontend scarcity balance
    STARTING_GOLD   =    600
    STARTING_MORALE =     85

    def __init__(self):
        self.map      = MapGraph()
        self.decision = DecisionEngine()
        self.war      = WarEngine()
        self._reset_state()

    def _reset_state(self):
        self.player_position = "Paris"
        self.controlled      = {"Paris"}
        self.resources = {
            "army":   self.STARTING_ARMY,
            "gold":   self.STARTING_GOLD,
            "morale": self.STARTING_MORALE,
            "turn":   1,
        }

    # ── Getters ───────────────────────────────────────────────

    def get_resources(self) -> dict:
        return dict(self.resources)

    def get_controlled_territories(self) -> list:
        return list(self.controlled)

    # ── Algorithms ────────────────────────────────────────────

    def explore_map_bfs(self) -> dict:
        return bfs(self.map, self.player_position)

    def explore_map_dfs(self) -> dict:
        return dfs(self.map, self.player_position)

    def best_routes(self) -> dict:
        result = dijkstra(self.map, self.player_position)
        result["distances"] = {
            k: (v if v != float("inf") else None)
            for k, v in result["distances"].items()
        }
        return result

    def reachable_targets(self) -> list:
        return bfs_reachable_from_controlled(self.map, self.controlled)

    # ── Decision engine ───────────────────────────────────────

    def choices(self) -> list:
        return self.decision.get_choices(
            controlled=list(self.controlled),
            resources=self.resources,
        )

    # ── Invasion ──────────────────────────────────────────────

    def invade(self, country: str) -> dict:
        if country not in self.map.get_countries():
            return {"result": "Error", "message": f"Unknown territory: {country}"}
        if country in self.controlled:
            return {"result": "Error", "message": f"{country} is already under Imperial control."}
        if country not in self.reachable_targets():
            return {"result": "Error", "message": f"{country} is not adjacent to your territory."}

        meta        = self.map.get_meta(country)
        gold_cost   = meta["cost"] * 50
        gold_reward = meta["gold"]

        if self.resources["gold"] < gold_cost:
            return {"result": "Error", "message": f"Insufficient gold. Need {gold_cost}g."}

        self.resources["gold"] -= gold_cost

        # Morale multiplies attacker effectiveness
        morale_mult  = 0.7 + (self.resources["morale"] / 100) * 0.6
        attacker_str = max(1, int((self.resources["army"] * morale_mult) // 1000))
        defender_str = meta["units"] // 500
        battle       = self.war.simulate_battle(attacker_str, defender_str)

        if battle["result"] == "Victory":
            self.controlled.add(country)
            self.resources["gold"]   += gold_reward
            self.resources["morale"]  = min(100, self.resources["morale"] + 5)
            message = f"Victory! {country} falls to the Grande Armée. (+{gold_reward} gold)"
        else:
            self.resources["gold"]   += gold_cost // 2   # partial refund
            self.resources["morale"]  = max(0, self.resources["morale"] - 10)
            message = f"Defeat! The offensive on {country} was repelled."

        return {
            "result":     battle["result"],
            "message":    message,
            "country":    country,
            "battle":     battle,
            "resources":  self.get_resources(),
            "controlled": self.get_controlled_territories(),
        }

    def end_turn(self) -> dict:
        self.resources["turn"] += 1
        n_cities = len(self.controlled)
        tax      = n_cities * 100
        self.resources["gold"] += tax
        return {
            "turn":      self.resources["turn"],
            "tax":       tax,
            "resources": self.get_resources(),
        }

    def reset(self) -> dict:
        self._reset_state()
        return {"message": "Game reset.", "resources": self.get_resources()}

    # ── Sync from frontend ────────────────────────────────────
    # The frontend is authoritative for rich game state (marshals, loot,
    # fog of war, commit fraction). This method keeps the backend in sync
    # so /state, /resources, /controlled always reflect reality.

    def sync_state(self, army: int, gold: int, morale: int,
                   turn: int, controlled: list) -> dict:
        self.resources["army"]   = max(0, int(army))
        self.resources["gold"]   = max(0, int(gold))
        self.resources["morale"] = max(0, min(100, int(morale)))
        self.resources["turn"]   = max(1, int(turn))
        self.controlled          = set(controlled)
        return {
            "synced":     True,
            "resources":  self.get_resources(),
            "controlled": self.get_controlled_territories(),
        }

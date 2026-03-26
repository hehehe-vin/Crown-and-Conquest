from map_graph import MapGraph
from algorithms.dfs import dfs
from algorithms.dijkstra import dijkstra
from decision_engine import DecisionEngine
from war_engine import WarEngine

class GameEngine:

    def __init__(self):

        self.map = MapGraph()
        self.decision = DecisionEngine()
        self.player_position = "France"
        self.controlled = {"France"}
        self.war = WarEngine()

    def explore_map(self):

        return dfs(self.map, self.player_position)

    def best_routes(self):

        return dijkstra(self.map, self.player_position)

    def get_controlled_territories(self):

        return list(self.controlled)

    def capture_country(self, country):

        self.controlled.add(country)
    
    def invade(self, country):

        if country in self.controlled:
            return "Already controlled"

        attacker = 10
        defender = 7

        result = self.war.simulate_battle(attacker, defender)

        if result == "Victory":
            self.controlled.add(country)

        return result
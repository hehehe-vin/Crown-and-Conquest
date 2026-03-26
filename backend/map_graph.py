from map_data import europe_map

class MapGraph:

    def __init__(self):
        self.graph = europe_map

    def get_neighbors(self, country):
        return self.graph.get(country, [])

    def get_countries(self):
        return list(self.graph.keys())
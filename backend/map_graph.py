# ─────────────────────────────────────────────────────────────────────────────
# map_graph.py  ·  Crown & Conquest – DAA-IV-T241
# ─────────────────────────────────────────────────────────────────────────────

from data.map_data import europe_map, territory_meta


class MapGraph:

    def __init__(self):
        self.graph = europe_map
        self.meta  = territory_meta

    def get_neighbors(self, country: str) -> list:
        """Return list of (neighbour_name, edge_weight) tuples."""
        return self.graph.get(country, [])

    def get_countries(self) -> list:
        return list(self.graph.keys())

    def get_meta(self, country: str) -> dict:
        """Return metadata dict for a territory (cost, units, gold, type)."""
        return self.meta.get(country, {})

    def get_all_meta(self) -> dict:
        return self.meta

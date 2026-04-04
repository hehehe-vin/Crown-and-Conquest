# ─────────────────────────────────────────────────────────────────────────────
# dijkstra.py  ·  Crown & Conquest – DAA-IV-T241
# Dijkstra's Shortest-Path Algorithm
# Time:  O((V+E) log V)   Space: O(V)
# ─────────────────────────────────────────────────────────────────────────────

import heapq


def dijkstra(graph, start: str) -> dict:
    """Shortest paths from `start` to all territories. Returns distances, parents, paths."""
    distances = {c: float("inf") for c in graph.get_countries()}
    distances[start] = 0
    parents = {c: None for c in graph.get_countries()}
    pq = [(0, start)]

    while pq:
        current_dist, current = heapq.heappop(pq)
        if current_dist > distances[current]:
            continue
        for neighbour, weight in graph.get_neighbors(current):
            new_dist = current_dist + weight
            if new_dist < distances[neighbour]:
                distances[neighbour] = new_dist
                parents[neighbour]   = current
                heapq.heappush(pq, (new_dist, neighbour))

    # Reconstruct full paths
    paths = {}
    for destination in graph.get_countries():
        if distances[destination] == float("inf"):
            paths[destination] = []
            continue
        path, node = [], destination
        while node is not None:
            path.append(node)
            node = parents[node]
        paths[destination] = list(reversed(path))

    return {"distances": distances, "parents": parents, "paths": paths}

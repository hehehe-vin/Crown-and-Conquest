# ─────────────────────────────────────────────────────────────────────────────
# bfs.py  ·  Crown & Conquest – DAA-IV-T241
# Breadth-First Search — territory exploration
# Time Complexity:  O(V + E)   where V = territories, E = borders
# Space Complexity: O(V)       for the visited set + queue
# ─────────────────────────────────────────────────────────────────────────────

from collections import deque


def bfs(graph, start: str) -> dict:
    """
    Perform BFS from `start` over the MapGraph.

    Returns a dict with:
      - 'order'   : list of territory names in BFS visit order
      - 'levels'  : dict mapping territory name → BFS depth (distance in hops)
      - 'parents' : dict mapping territory name → its BFS-tree parent
    """
    visited = {start}
    queue   = deque([start])
    order   = []
    levels  = {start: 0}
    parents = {start: None}

    while queue:
        current = queue.popleft()
        order.append(current)

        for neighbour, _weight in graph.get_neighbors(current):
            if neighbour not in visited:
                visited.add(neighbour)
                queue.append(neighbour)
                levels[neighbour]  = levels[current] + 1
                parents[neighbour] = current

    return {
        "order":   order,
        "levels":  levels,
        "parents": parents,
    }


def bfs_reachable_from_controlled(graph, controlled: set) -> list:
    """
    Return all territories reachable (adjacent) to any currently controlled
    territory that are NOT yet controlled.  Used to decide legal invasion targets.
    """
    reachable = []
    for city in controlled:
        for neighbour, _w in graph.get_neighbors(city):
            if neighbour not in controlled and neighbour not in reachable:
                reachable.append(neighbour)
    return reachable

# ─────────────────────────────────────────────────────────────────────────────
# bfs.py  ·  Crown & Conquest – DAA-IV-T241
# Breadth-First Search — territory exploration
# Time:  O(V + E)   Space: O(V)
# ─────────────────────────────────────────────────────────────────────────────

from collections import deque


def bfs(graph, start: str) -> dict:
    """BFS from `start`. Returns order, levels (hop distances), and parent tree."""
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

    return {"order": order, "levels": levels, "parents": parents}


def bfs_reachable_from_controlled(graph, controlled: set) -> list:
    """Return all uncontrolled territories adjacent to any controlled territory."""
    reachable = []
    for city in controlled:
        for neighbour, _w in graph.get_neighbors(city):
            if neighbour not in controlled and neighbour not in reachable:
                reachable.append(neighbour)
    return reachable

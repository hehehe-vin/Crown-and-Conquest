# ─────────────────────────────────────────────────────────────────────────────
# dfs.py  ·  Crown & Conquest – DAA-IV-T241
# Depth-First Search — deep path traversal
# Time:  O(V + E)   Space: O(V)
# ─────────────────────────────────────────────────────────────────────────────


def dfs(graph, start: str, visited: set = None, order: list = None,
        parents: dict = None) -> dict:
    """Recursive DFS from `start`. Returns order and parent tree."""
    if visited is None:
        visited = set()
        order   = []
        parents = {start: None}

    visited.add(start)
    order.append(start)

    for neighbour, _weight in graph.get_neighbors(start):
        if neighbour not in visited:
            parents[neighbour] = start
            dfs(graph, neighbour, visited, order, parents)

    return {"order": order, "parents": parents}

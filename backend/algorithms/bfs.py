from collections import deque

def bfs(graph, start):
    """
    Breadth-First Search traversal from a starting node.
    Explores the map level by level (nearest neighbors first).
    Time complexity: O(V + E)

    Args:
        graph: MapGraph object with .graph dict and .get_neighbors()
        start: Starting country name (string)

    Returns:
        List of countries visited in BFS order
    """
    if start not in graph.graph:
        return []

    visited = set()
    queue = deque([start])
    visited.add(start)
    result = []

    while queue:
        current = queue.popleft()
        result.append(current)

        for neighbor, _distance in graph.get_neighbors(current):
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)

    return result

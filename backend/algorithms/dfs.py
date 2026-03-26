def dfs(graph, start, visited=None, result=None):
    """
    Depth-First Search traversal from a starting node.
    Explores as far as possible along each branch before backtracking.
    Time complexity: O(V + E)

    Args:
        graph: MapGraph object with .get_neighbors()
        start: Starting country name (string)
        visited: Set of already-visited nodes (used in recursion)
        result: Ordered list of visited countries (used in recursion)

    Returns:
        List of countries visited in DFS order
    """
    # Bug fix: result was missing — only visited (a set) was returned,
    # which loses the traversal ORDER needed to show algorithm steps.
    if visited is None:
        visited = set()
    if result is None:
        result = []

    visited.add(start)
    result.append(start)   # <-- was missing: set() has no order

    for neighbor, _weight in graph.get_neighbors(start):
        if neighbor not in visited:
            dfs(graph, neighbor, visited, result)

    return result

def dfs(graph, start, visited=None):

    if visited is None:
        visited = set()

    visited.add(start)

    for neighbor, weight in graph.get_neighbors(start):
        if neighbor not in visited:
            dfs(graph, neighbor, visited)

    return list(visited)
import heapq

def dijkstra(graph, start):
    """
    Dijkstra's shortest path algorithm from a starting node.
    Finds least-cost route to every reachable country.
    Time complexity: O((V + E) log V)

    Args:
        graph: MapGraph object with .get_countries() and .get_neighbors()
        start: Starting country name (string)

    Returns:
        distances: dict mapping each country to its minimum cost from start
        previous:  dict mapping each country to its predecessor on the shortest path
                   (allows full path reconstruction — was missing in original)
    """
    countries = graph.get_countries()
    distances = {c: float('inf') for c in countries}
    previous  = {c: None        for c in countries}   # <-- was missing
    distances[start] = 0

    # (cost, country)
    pq = [(0, start)]

    while pq:
        current_distance, current_country = heapq.heappop(pq)

        # Skip stale entries in the priority queue
        if current_distance > distances[current_country]:
            continue

        for neighbor, weight in graph.get_neighbors(current_country):
            distance = current_distance + weight

            if distance < distances[neighbor]:
                distances[neighbor] = distance
                previous[neighbor] = current_country
                heapq.heappush(pq, (distance, neighbor))

    return distances, previous


def reconstruct_path(previous, target):
    """
    Walk back through the previous-node map to build the full path to target.

    Args:
        previous: dict returned by dijkstra()
        target:   destination country name

    Returns:
        List of country names from start to target, or [] if unreachable
    """
    path = []
    node = target
    while node is not None:
        path.append(node)
        node = previous[node]
    path.reverse()
    # If the path doesn't start at any real source, it's unreachable
    return path if len(path) > 1 or (len(path) == 1 and previous.get(path[0]) is None) else []

import heapq

def dijkstra(graph, start):

    distances = {country: float('inf') for country in graph.get_countries()}
    distances[start] = 0

    pq = [(0, start)]

    while pq:

        current_distance, current_country = heapq.heappop(pq)

        for neighbor, weight in graph.get_neighbors(current_country):

            distance = current_distance + weight

            if distance < distances[neighbor]:
                distances[neighbor] = distance
                heapq.heappush(pq, (distance, neighbor))

    return distances
# Europe map as adjacency list: { country: [(neighbor, distance/cost), ...] }
# Country names aligned with the frontend territory names.
# All edge weights are non-negative (required for Dijkstra's algorithm).

europe_map = {
    "Paris":         [("London", 4), ("Madrid", 3), ("Rome", 5), ("Amsterdam", 2)],
    "London":        [("Paris", 4), ("Amsterdam", 3)],
    "Madrid":        [("Paris", 3), ("Lisbon", 2), ("Rome", 6)],
    "Lisbon":        [("Madrid", 2)],
    "Rome":          [("Paris", 5), ("Madrid", 6), ("Vienna", 3), ("Athens", 4)],
    "Amsterdam":     [("Paris", 2), ("London", 3), ("Berlin", 3)],
    "Berlin":        [("Amsterdam", 3), ("Vienna", 2), ("Warsaw", 4), ("Copenhagen", 3)],
    "Copenhagen":    [("Berlin", 3), ("Stockholm", 4)],
    "Stockholm":     [("Copenhagen", 4)],
    "Vienna":        [("Berlin", 2), ("Rome", 3), ("Warsaw", 3), ("Budapest", 2)],
    "Budapest":      [("Vienna", 2), ("Warsaw", 3), ("Constantinople", 5)],
    "Warsaw":        [("Berlin", 4), ("Vienna", 3), ("Budapest", 3), ("Moscow", 6)],
    "Athens":        [("Rome", 4), ("Constantinople", 3)],
    "Constantinople":[("Athens", 3), ("Moscow", 8), ("Budapest", 5)],
    "Moscow":        [("Warsaw", 6), ("Constantinople", 8)],
}

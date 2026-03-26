# ─────────────────────────────────────────────────────────────────────────────
# map_data.py  ·  Crown & Conquest – DAA-IV-T241
# Europe graph — adjacency list with edge weights (invasion cost / distance)
# Each entry:  "City": [("Neighbour", weight), ...]
# Matches the 15 territories defined in index.html (T array, ids 0-14)
# ─────────────────────────────────────────────────────────────────────────────

europe_map = {
    # id 0
    "Paris":      [("London", 4),  ("Brussels", 3), ("Madrid", 6)],

    # id 1
    "London":     [("Paris", 4),   ("Brussels", 3)],

    # id 2
    "Brussels":   [("Paris", 3),   ("London", 3),   ("Amsterdam", 2), ("Berlin", 5)],

    # id 3
    "Amsterdam":  [("Brussels", 2),("Copenhagen", 4),("Berlin", 3)],

    # id 4
    "Copenhagen": [("Amsterdam", 4),("Berlin", 4)],

    # id 5
    "Berlin":     [("Brussels", 5),("Amsterdam", 3),("Copenhagen", 4),
                   ("Prague", 3),  ("Warsaw", 5)],

    # id 6
    "Prague":     [("Berlin", 3),  ("Munich", 3),   ("Vienna", 4), ("Warsaw", 4)],

    # id 7
    "Munich":     [("Prague", 3),  ("Vienna", 3),   ("Milan", 4)],

    # id 8
    "Vienna":     [("Prague", 4),  ("Munich", 3),   ("Warsaw", 5)],

    # id 9
    "Milan":      [("Munich", 4),  ("Rome", 3),     ("Madrid", 8)],

    # id 10
    "Rome":       [("Milan", 3),   ("Naples", 3)],

    # id 11
    "Naples":     [("Rome", 3)],

    # id 12
    "Madrid":     [("Paris", 6),   ("Milan", 8)],

    # id 13
    "Warsaw":     [("Berlin", 5),  ("Prague", 4),   ("Vienna", 5), ("Moscow", 7)],

    # id 14
    "Moscow":     [("Warsaw", 7)],
}

# Extra metadata used by the resource engine and war engine
# cost = number of "cost units" (matches T[i].cost in frontend)
# units = garrison strength  (matches T[i].units in frontend)
# gold  = reward on capture  (matches T[i].gold  in frontend)
territory_meta = {
    "Paris":      {"cost": 0,  "units": 5000, "gold": 0,    "type": "capital"},
    "London":     {"cost": 4,  "units": 3000, "gold": 400,  "type": "city"},
    "Brussels":   {"cost": 3,  "units": 2000, "gold": 350,  "type": "fort"},
    "Amsterdam":  {"cost": 4,  "units": 2500, "gold": 480,  "type": "city"},
    "Copenhagen": {"cost": 5,  "units": 2000, "gold": 300,  "type": "city"},
    "Berlin":     {"cost": 9,  "units": 4500, "gold": 900,  "type": "capital"},
    "Prague":     {"cost": 5,  "units": 2000, "gold": 380,  "type": "city"},
    "Munich":     {"cost": 4,  "units": 1500, "gold": 420,  "type": "fort"},
    "Vienna":     {"cost": 10, "units": 4000, "gold": 1100, "type": "capital"},
    "Milan":      {"cost": 5,  "units": 2200, "gold": 650,  "type": "city"},
    "Rome":       {"cost": 6,  "units": 3000, "gold": 700,  "type": "city"},
    "Naples":     {"cost": 4,  "units": 1800, "gold": 500,  "type": "fort"},
    "Madrid":     {"cost": 6,  "units": 4000, "gold": 600,  "type": "city"},
    "Warsaw":     {"cost": 9,  "units": 3500, "gold": 850,  "type": "capital"},
    "Moscow":     {"cost": 14, "units": 6000, "gold": 1500, "type": "capital"},
}

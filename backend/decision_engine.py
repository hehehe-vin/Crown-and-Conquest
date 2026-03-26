class DecisionEngine:
    def get_choices(self):
        return [
            "Invade Austria",
            "Attack Spain",
            "Strengthen Army",
            "Forge Alliance",
            "Advance on Russia"
        ]

    def evaluate_strategy(self, resources, territories_held):
        """
        Greedy heuristic: recommend an action based on current game state.
        """
        if resources.get("soldiers", 0) < 150:
            return "Strengthen Army"
        if resources.get("gold", 0) < 500:
            return "Forge Alliance"
        if territories_held < 5:
            return "Invade Austria"
        return "Advance on Russia"
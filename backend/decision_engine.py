# ─────────────────────────────────────────────────────────────────────────────
# decision_engine.py  ·  Crown & Conquest – DAA-IV-T241
# Context-sensitive strategic choices for the player
# ─────────────────────────────────────────────────────────────────────────────


class DecisionEngine:

    def get_choices(self, controlled: list, resources: dict) -> list:
        """Return strategic choices based on current game state."""
        choices = []

        choices.append({
            "action":      "reinforce",
            "label":       "Reinforce the Army",
            "description": "Spend gold to recruit more troops.",
            "cost_gold":   500,
            "gain_army":   3000,
        })

        if resources.get("morale", 100) < 60:
            choices.append({
                "action":      "boost_morale",
                "label":       "Rally the Troops",
                "description": "Spend gold to boost morale.",
                "cost_gold":   300,
                "gain_morale": 20,
            })

        choices.append({
            "action":      "expand",
            "label":       "Press the Advance",
            "description": "Invade an adjacent territory.",
            "cost_gold":   0,
        })

        return choices

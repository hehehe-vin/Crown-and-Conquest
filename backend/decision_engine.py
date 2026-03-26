# ─────────────────────────────────────────────────────────────────────────────
# decision_engine.py  ·  Crown & Conquest – DAA-IV-T241
#
# BUG FIXED: original code had `return` on its own line BEFORE the list,
# so get_choices() always returned None (the list was unreachable dead code).
# ─────────────────────────────────────────────────────────────────────────────


class DecisionEngine:

    def get_choices(self, controlled: list, resources: dict) -> list:
        """
        Return context-sensitive strategic choices based on current game state.
        `controlled` — list of territory names the player owns
        `resources`  — dict with keys: army, gold, morale
        """
        choices = []

        # Always available
        choices.append({
            "action":      "reinforce",
            "label":       "Reinforce the Army",
            "description": "Spend gold to recruit more troops.",
            "cost_gold":   500,
            "gain_army":   3000,
        })

        # Only if morale is low
        if resources.get("morale", 100) < 60:
            choices.append({
                "action":      "boost_morale",
                "label":       "Rally the Troops",
                "description": "Spend gold to boost morale.",
                "cost_gold":   300,
                "gain_morale": 20,
            })

        # Expansion choices — adjacent unconquered territories
        choices.append({
            "action":      "expand",
            "label":       "Press the Advance",
            "description": "Invade an adjacent territory.",
            "cost_gold":   0,
        })

        return choices  # ← FIX: return is now on the SAME line as the value

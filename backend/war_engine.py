# ─────────────────────────────────────────────────────────────────────────────
# war_engine.py  ·  Crown & Conquest – DAA-IV-T241
# Simulates battle outcomes with randomised combat rolls
# ─────────────────────────────────────────────────────────────────────────────

import random


class WarEngine:

    def simulate_battle(self, attacker_strength: int, defender_strength: int) -> dict:
        """
        Roll combat dice — attacker wins if roll beats defender.
        Returns result, powers, and margin.
        """
        atk_roll = attacker_strength + random.randint(0, 5)
        def_roll = defender_strength  + random.randint(0, 5)
        result   = "Victory" if atk_roll > def_roll else "Defeat"

        return {
            "result":        result,
            "attack_power":  atk_roll,
            "defense_power": def_roll,
            "margin":        atk_roll - def_roll,
        }

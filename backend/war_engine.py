import random

class WarEngine:

    def simulate_battle(self, attacker_strength, defender_strength):

        attack_power = attacker_strength + random.randint(0,5)
        defense_power = defender_strength + random.randint(0,5)

        if attack_power > defense_power:
            return "Victory"
        else:
            return "Defeat"
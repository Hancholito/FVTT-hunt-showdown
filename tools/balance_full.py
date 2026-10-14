#!/usr/bin/env python3
"""Full balance check: every arsenal weapon against every monster and against a hunter, with the module's rules.

Single target (scripts/weapons.js): attack 4dF + skill vs 4dF + Athletics (+ phase defence). shifts < 0 miss,
0 near miss (Pinned, no damage), > 0 hit: shifts + power + extra-shot '+', then ballistic die (two dice kept
best on 3+ shifts): + Vital +2, − Graze −2 (min 1). Cone (resolveMulti): no ballistic, max(1, shifts + power + '+').
Explosives: throw total vs Athletics, damage shifts + power, power 0 = no damage.
Apply (scripts/damage.js): Vital kills (vitalKills); fire kills non-boss, non-fireproof, non-immune monsters;
armour reduces non-Vital hits (vitalPierces: Vital ignores it); monsters die on their last box.
Bosses: consequences 2/4/6 used when a hit would kill. Hunters: 6 boxes, Downed on overflow;
policy "cons" uses Mild 2 / Moderate 4 / Severe 6 when a hit would down them.
Each attack uses the weapon's maximum extra shots at its best band. Attacker skill Good (+3).
"""
import json, random, statistics, pathlib, sys

random.seed(11)
ROOT = pathlib.Path(__file__).resolve().parent.parent
arsenal = json.load(open(ROOT / "data/arsenal.json"))
bestiary = json.load(open(ROOT / "data/bestiary.json"))
EXTRA = {"single": 0, "bolt": 0, "lever": 1, "pump": 1, "sa_revolver": 1, "da_revolver": 2, "semi": 2, "double": 1, "melee": 0, "thrown": 0}
N = int(sys.argv[1]) if len(sys.argv) > 1 else 4000
SKILL = 3
MAXA = 30

def df(n): return sum(random.choice((-1, 0, 1)) for _ in range(n))

def one_attack(w, athl, defence_bonus=0):
    """Returns (damage, vital, hit) for one attack action."""
    p = w["power"][w["best"]]
    ex = w.get("explosive")
    if ex:
        if p <= 0: return 0, False, False
        total = df(4) + 2  # Throw Fair (+2), a typical non-Sapper
        shifts = total - (df(4) + athl + defence_bonus)
        if shifts <= 0: return 0, False, False
        return shifts + p, False, True
    extra = 0 if w["action"] in ("melee",) else min(EXTRA[w["action"]], max(0, w["capacity"] - 1))
    shifts = df(4) + SKILL - (df(4) + athl + defence_bonus)
    if shifts <= 0: return 0, False, False
    plus = sum(1 for _ in range(extra) if df(1) > 0)
    if w.get("shape") == "cone":
        return max(1, shifts + p + plus), False, True
    best = max(df(1) for _ in range(2 if shifts >= 3 else 1))
    d = shifts + p + plus
    if best > 0: d += 2
    elif best < 0: d = max(1, d - 2)
    return max(1, d), best > 0, True

def fiery(w):
    return bool(w.get("explosive", {}).get("fire")) or "Burning" in (w.get("conditions") or [])

def vs_monster(w, m):
    out = []
    boss = m["category"] == "boss"
    phase_def = 0  # Attack phase
    fire_kills = fiery(w) and not boss and not m.get("fireproof") and "Burning" not in (m.get("immune") or [])
    for _ in range(N):
        hp, cons, k = m["health"], ([6, 4, 2] if boss else []), 0
        while hp > 0 and k < MAXA:
            k += 1
            d, vital, hit = one_attack(w, m["skills"].get("Athletics", 0), phase_def)
            if not hit: continue
            if fire_kills: hp = 0; break
            if vital and m.get("vitalKills"): hp = 0; break
            arm = m.get("armor", 0)
            if arm and not (vital and m.get("vitalPierces")): d = max(0, d - arm)
            if d >= hp and cons:
                c = cons.pop(0); d = max(0, d - c)
            hp -= d
        out.append(k)
    return statistics.mean(out)

def vs_hunter(w, use_cons, athl=2):
    out = []
    for _ in range(N):
        free, cons, k, down = 6, ([2, 4, 6] if use_cons else []), 0, False
        while not down and k < MAXA:
            k += 1
            d, vital, hit = one_attack(w, athl)
            if not hit or d <= 0: continue
            if d > free and cons:
                fit = [c for c in cons if d - c <= free]
                c = min(fit) if fit else max(cons)
                cons.remove(c); d = max(0, d - c)
            if d > free: down = True
            else: free -= d
        out.append(k)
    return statistics.mean(out)

def monster_attack_vs_hunter(m):
    rows = []
    for a in m["attacks"]:
        skill = m["skills"].get(a["skill"], 0)
        dmg, hits = [], 0
        for _ in range(N):
            shifts = df(4) + skill - (df(4) + 2)
            if shifts <= 0: dmg.append(0); continue
            hits += 1
            if a.get("shape") == "cone": dmg.append(max(1, shifts + a["power"])); continue
            best = max(df(1) for _ in range(2 if shifts >= 3 else 1))
            d = shifts + a["power"] + (2 if best > 0 else 0)
            if best < 0: d = max(1, d - 2)
            dmg.append(max(1, d))
        rows.append((m["name"], a["name"], hits / N, statistics.mean([d for d in dmg if d] or [0]), statistics.mean(dmg)))
    return rows

if __name__ == "__main__":
    weapons = [e for e in arsenal if e.get("weapon")]
    mons = [m for m in bestiary]
    short = {"The Butcher": "Butch", "The Spider": "Spidr", "The Assassin": "Assas", "Water Devil": "WDevl", "Immolator": "Immol", "Hellhound": "Hound", "Scrapbeak": "Scrap", "Meathead": "Meat", "Armored": "Armor"}
    head = ["Hunter", "+cons"] + [short.get(m["name"], m["name"][:5]) for m in mons]
    print(f"{'weapon':30} {'cat':8} " + " ".join(f"{h:>6}" for h in head))
    results = []
    for e in weapons:
        w = e["weapon"]
        row = [vs_hunter(w, False), vs_hunter(w, True)] + [vs_monster(w, m) for m in mons]
        results.append((e["category"], e["name"], row))
        print(f"{e['name']:30} {e['category']:8} " + " ".join(f"{v:6.1f}" for v in row), flush=True)
    json.dump({"head": head, "rows": [{"cat": c, "name": n, "vals": r} for c, n, r in results]}, open("/tmp/claude-0/balance.json", "w"))
    print("\nMonster attacks vs a hunter (Athletics +2):")
    for m in mons:
        for name, att, hit, per_hit, per_att in monster_attack_vs_hunter(m):
            print(f"  {name:14} {att:16} hit {hit*100:3.0f}%  dmg/hit {per_hit:4.1f}  dmg/attack {per_att:4.1f}")

#!/usr/bin/env python3
"""Monte Carlo balance check of the Hunt arsenal (module rules, scripts/weapons.js).

Attack: 4dF + skill vs 4dF + Athletics (+ range penalty, + cover). shifts = atk − opp.
Miss if shifts < 0; tie = Pinned, no damage. Hit: damage = shifts + power + extra '+' dice,
then ballistic die (2 keep best on 3+ shifts): + → +2 and Bleeding, − → −2 (min 1).
Extra shots: each '−' adds weapon stress (jam when stress reaches reliability).
"""
import json, random, statistics, sys, pathlib

random.seed(7)
EXTRA = {"single": 0, "bolt": 0, "lever": 1, "pump": 1, "sa_revolver": 1, "da_revolver": 2, "semi": 2, "double": 1, "melee": 0, "thrown": 0}
BANDS = ["Close", "Medium", "Long", "Extreme"]
N = 20000

def df(n): return sum(random.choice((-1, 0, 1)) for _ in range(n))

def attack(power, skill, defence, penalty, extra, spread=False):
    shifts = df(4) + skill - (df(4) + defence + penalty)
    if shifts < 0: return 0.0, False
    if shifts == 0: return 0.0, False
    plus = minus = 0
    for _ in range(extra):
        r = df(1)
        plus += r > 0; minus += r < 0
    dmg = shifts + power + plus
    if not spread:
        faces = [df(1) for _ in range(2 if shifts >= 3 else 1)]
        best = max(faces)
        if best > 0: dmg += 2
        elif best < 0: dmg = max(1, dmg - 2)
    return max(1, dmg), True

def sim(w, skill=3, defence=2, band=None, extra=None, spread=False):
    band = band or w["best"]
    p = w["power"].get(band)
    if p is None: return None
    pen = abs(BANDS.index(band) - BANDS.index(w["best"]))
    ex = EXTRA[w["action"]] if extra is None else extra
    ex = min(ex, max(0, w["capacity"] - 1)) if w["action"] not in ("melee",) else 0
    dmgs, hits = [], 0
    for _ in range(N):
        d, h = attack(p, skill, defence, pen, ex, spread)
        dmgs.append(d); hits += h
    return {"hit": hits / N, "avg": statistics.mean(dmgs), "avgHit": statistics.mean([d for d in dmgs if d > 0] or [0]), "shots": 1 + ex}

if __name__ == "__main__":
    data = json.load(open(pathlib.Path(__file__).resolve().parent.parent / "data" / "arsenal.json"))
    rows = []
    for it in data:
        w = it.get("weapon")
        if not w or w.get("explosive"): continue
        spread = w.get("shape") == "cone"
        r = sim(w, spread=spread)
        rows.append((it["category"], it["name"], w["action"], w["best"], w["power"][w["best"]], w["capacity"], r["shots"], r["hit"], r["avgHit"], r["avg"], w["reliability"], w["slot"]))
    rows.sort(key=lambda r: (r[0], -r[9]))
    print(f"{'cat':8} {'weapon':30} {'action':12} {'best':7} {'pow':>3} {'cap':>3} {'shots':>5} {'hit%':>5} {'dmg/hit':>7} {'dmg/atk':>7} {'rel':>3} slot")
    for r in rows:
        print(f"{r[0]:8} {r[1]:30} {r[2]:12} {r[3]:7} {r[4]:>3} {r[5]:>3} {r[6]:>5} {r[7]*100:5.0f} {r[8]:7.2f} {r[9]:7.2f} {r[10]:>3} {r[11]}")

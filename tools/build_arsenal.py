#!/usr/bin/env python3
"""Builds data/arsenal.json for Hunt: Showdown RPG (Fate Core Official).

Power scale (damage on a hit = shifts + power + ballistic die):
  1 light (fusee, fire bombs)      2 compact ammo (Nagant, Winfield)
  3 medium ammo (Vetterli, Pax)    4 long ammo (Mosin, Martini)
  5 Sparks / big shotgun at Close  6 Nitro Express, big dynamite
Range bands: Close, Medium, Long, Extreme. Empty = out of range. "best" = no range penalty.
Slots as in Hunt: Small 1, Medium 2, Large 3 (firearms and bows only). Melee and thrown weapons are tools.
"""
import json, copy, pathlib

IMG = "modules/hunt-showdown-fco/assets/"
items = []

def P(c=None, m=None, l=None, e=None):
    return {"Close": c, "Medium": m, "Long": l, "Extreme": e}

def gun(name, cat, desc, action, power, best, cap, reserve, rel, slot, img, shape="single", conditions=None, ammo="standard", notes=None):
    items.append({
        "name": name, "category": cat, "img": IMG + img,
        "description": f"<p>{desc}</p>",
        "weapon": {
            "skill": "Shoot", "action": action, "power": power, "best": best,
            "capacity": cap, "loaded": cap, "reserve": reserve, "maxReserve": reserve,
            "ammo": ammo, "reliability": rel, "stress": 0, "slot": slot,
            "conditions": conditions or [], "shape": shape,
            **({"notes": notes} if notes else {}),
            **({"tool": True} if notes and notes.startswith("Tool") else {})
        }
    })

def melee(name, desc, power, slot, conditions=None, notes=None):
    items.append({
        "name": name, "category": "melee", "img": IMG + "weapon-melee.svg",
        "description": f"<p>{desc}</p>",
        "weapon": {
            "skill": "Fight", "action": "melee", "power": P(power), "best": "Close",
            "capacity": 0, "loaded": 0, "reserve": 0, "maxReserve": 0,
            "ammo": "standard", "reliability": 1, "stress": 0, "slot": slot,
            "conditions": conditions or [], "shape": "single",
            **({"notes": notes} if notes else {}),
            **({"blunt": True} if notes and notes.startswith("Blunt") else {})
        }
    })

def thrown(name, desc, power, best, count, conditions=None, notes=None):
    items.append({
        "name": name, "category": "thrown", "img": IMG + "weapon-thrown.svg",
        "description": f"<p>{desc}</p>",
        "weapon": {
            "skill": "Throw", "action": "thrown", "power": power, "best": best,
            "capacity": count, "loaded": count, "reserve": 0, "maxReserve": 0,
            "ammo": "standard", "reliability": 1, "stress": 0, "slot": "Small",
            "conditions": conditions or [], "shape": "single", "recoverable": True,
            **({"notes": notes} if notes else {})
        }
    })

def bomb(name, cat, desc, power, radius, conditions=None, zone="", fire=False, sticky=False, charges=1, img="explosive.svg", notes=None):
    items.append({
        "name": name, "category": cat, "img": IMG + img,
        "description": f"<p>{desc}</p>",
        "weapon": {
            "skill": "Throw", "action": "thrown", "power": P(power, power, power), "best": "Medium",
            "capacity": charges, "loaded": charges, "reserve": 0, "maxReserve": 0,
            "ammo": "standard", "reliability": 1, "stress": 0, "slot": "Small",
            "conditions": conditions or [], "shape": "area",
            "explosive": {"blast": True, "sticky": sticky, "fire": fire, "zoneAspect": zone, "radius": radius},
            **({"notes": notes} if notes else {})
        }
    })

def support(name, desc, kind, uses, effect, img="support.svg", target="self"):
    items.append({
        "name": name, "category": "support", "img": IMG + img,
        "description": f"<p>{desc}</p>",
        "support": {"kind": kind, "uses": uses, "usesMax": uses, "target": target, "effect": effect}
    })

# ------------------------------------------------------------------ Handguns
H = "handgun"; S = "weapon-short.svg"
gun("Nagant M1895", H, "Double-action seven-shot revolver. Light round, quick trigger.", "da_revolver", P(2, 2), "Close", 7, 14, 3, "Small", S)
gun("Nagant M1895 Officer", H, "Lightened Nagant with a crisp trigger: fires as fast as you can pull.", "da_revolver", P(2, 2), "Close", 7, 14, 2, "Small", S)
gun("Caldwell Conversion", H, "Single-action six-shooter converted to cartridges. Heavier round than the Nagant.", "sa_revolver", P(3, 2), "Close", 6, 12, 3, "Small", S)
gun("Caldwell Conversion Uppercut", H, "Conversion chambered for rifle rounds. Kicks hard, carries far.", "sa_revolver", P(3, 3, 2), "Close", 6, 12, 2, "Small", S)
gun("Caldwell Pax", H, "Big single-action revolver in medium calibre. The frontier peacemaker.", "sa_revolver", P(3, 3), "Close", 6, 12, 3, "Small", S)
gun("Scottfield Model 3", H, "Break-action revolver: reloading is a free action once per exchange.", "sa_revolver", P(3, 2), "Close", 6, 12, 3, "Small", S, notes="Reload is a free action (once per exchange)")
gun("Bornheim No. 3", H, "Semi-automatic pistol. Weak round, lots of them, quickly.", "semi", P(2, 1), "Close", 5, 15, 2, "Small", S)
gun("Dolch 96", H, "Ten-round semi-automatic with a stripper clip. Rare, precise, expensive.", "semi", P(3, 3, 2), "Medium", 10, 10, 2, "Small", S)
gun("LeMat Mark II", H, "Nine-shot revolver with a shotgun barrel under the cylinder.", "da_revolver", P(2, 2), "Close", 9, 9, 2, "Small", S, notes="Once per load, fire the shotgun barrel instead: Close 3, cone")
gun("Sparks Pistol", H, "A Sparks action cut down to a pistol. One rifle round in the palm of your hand.", "single", P(4, 3, 2), "Close", 1, 10, 1, "Small", S)
gun("Romero 77 Handcannon", H, "Sawn-off Romero. Fits in a holster, fills a doorway with lead.", "single", P(3), "Close", 1, 8, 3, "Small", S, shape="cone")
gun("Caldwell Rival 78 Handcannon", H, "Sawn-off double barrel. Two shells, no range.", "double", P(3), "Close", 2, 8, 3, "Medium", S, shape="cone")
gun("Specter 1882 Compact", H, "Cut-down pump shotgun. Three shells.", "pump", P(3, 1), "Close", 3, 9, 3, "Medium", S, shape="cone")
gun("Quad Derringer", H, "Four tiny barrels, a tool rather than a weapon. For the last word.", "double", P(2), "Close", 4, 8, 2, "Small", S, notes="Tool: does not use a weapon slot")
gun("Flare Pistol", H, "Fires a burning flare: sets whatever it hits alight and lights up the zone.", "single", P(1, 1), "Close", 1, 2, 2, "Small", S, conditions=["Burning"], notes="Tool: does not use a weapon slot. The zone gets the aspect Lit Up")
gun("Hand Crossbow", H, "Silent, slow, and its bolts can be poisoned.", "single", P(2, 2), "Close", 1, 4, 1, "Small", S, notes="Tool: does not use a weapon slot. Silent: no Notice roll to hear it")

# ------------------------------------------------------------------ Long guns
L = "longgun"; LG = "weapon-long.svg"
gun("Winfield M1873", L, "Lever-action rifle. Light round, fifteen of them.", "lever", P(2, 2, 1), "Medium", 15, 15, 3, "Large", LG)
gun("Winfield M1873C", L, "Carbine Winfield: shorter, eight rounds, fits a medium slot.", "lever", P(2, 2), "Medium", 8, 16, 3, "Medium", LG)
gun("Winfield 1876 Centennial", L, "Lever-action in medium calibre. The Winfield that hits.", "lever", P(3, 3, 2), "Medium", 10, 10, 3, "Large", LG)
gun("Springfield 1866", L, "Trapdoor single-shot carbine. Simple, reliable, medium calibre.", "single", P(3, 3, 2), "Medium", 1, 12, 4, "Medium", LG)
gun("Vetterli 71 Karabiner", L, "Bolt-action carbine, six rounds, medium calibre. Does everything well enough.", "bolt", P(3, 3, 3), "Medium", 6, 12, 3, "Medium", LG)
gun("Mosin-Nagant M1891", L, "Bolt-action rifle, five long rounds. Deadly at range.", "bolt", P(3, 4, 4, 3), "Long", 5, 10, 3, "Large", LG)
gun("Lebel 1886", L, "Tube-fed bolt-action, eight long rounds. Slow to top up.", "bolt", P(3, 4, 4, 3), "Long", 8, 8, 2, "Large", LG)
gun("Krag 1896", L, "Smooth bolt-action, side-loading magazine. Reloads fast.", "bolt", P(3, 4, 4, 3), "Long", 5, 10, 2, "Large", LG, notes="Reload is a free action (once per exchange)")
gun("Martini-Henry IC1", L, "Falling-block single shot. A heavy round, a slow reload.", "single", P(3, 4, 4), "Medium", 1, 12, 2, "Large", LG)
gun("Sparks LRR", L, "Single-shot long-range rifle. One round, one chance, a lot of noise.", "single", P(4, 5, 5, 5), "Long", 1, 10, 1, "Large", LG)
gun("Mosin-Nagant Avtomat", L, "Semi-automatic Mosin, fifteen rounds. Jams if you look at it wrong.", "semi", P(3, 4, 3), "Medium", 15, 15, 1, "Large", LG)
gun("Nitro Express", L, "Elephant gun. Two rounds that stop anything that walks, bosses included.", "double", P(6, 6, 5), "Close", 2, 4, 1, "Large", LG, notes="Ignores 1 point of armour")
gun("Drilling", L, "Two shotgun barrels over a rifle barrel.", "double", P(3, 3, 3), "Medium", 1, 10, 2, "Large", LG, notes="Also carries 2 shotgun shells: Close 4, cone; swap barrels as a free action")
gun("Bomb Lance", L, "Whaling harpoon launcher. Fires one explosive lance, then it is a spear.", "single", P(5, 2), "Close", 1, 3, 1, "Large", LG, conditions=["Bleeding"], notes="Melee with Fight: Close 3")
gun("Hunting Bow", L, "Silent and quick to draw. Arrows can be recovered.", "single", P(3, 3, 2), "Medium", 1, 10, 4, "Large", LG, notes="Silent. Arrows are recovered after the fight (Bolt Seer: always)")
gun("Crossbow", L, "Silent, slow, heavy bolts. Explosive and poison bolts exist.", "single", P(4, 4, 3), "Medium", 1, 6, 4, "Large", LG, notes="Silent. Bolts are recovered after the fight (Bolt Seer: always)")
gun("Romero 77", L, "Single-barrel shotgun. Its spread hits everyone in front of the shooter (cone).", "single", P(4, 1), "Close", 1, 10, 3, "Large", LG, shape="cone")
gun("Caldwell Rival 78", L, "Double-barrel shotgun. Both barrels in one exchange if you like.", "double", P(4, 1), "Close", 2, 10, 3, "Large", LG, shape="cone")
gun("Specter 1882", L, "Pump-action shotgun, five shells.", "pump", P(4, 1), "Close", 5, 10, 3, "Large", LG, shape="cone")
gun("Terminus", L, "Lever-action shotgun, six shells. Fast and loud.", "lever", P(4, 1), "Close", 6, 12, 2, "Large", LG, shape="cone")
gun("Crown & King", L, "Semi-automatic shotgun. Five shells as fast as you can pull.", "semi", P(3, 1), "Close", 5, 10, 2, "Large", LG, shape="cone")
gun("Slate", L, "Heavy double-barrel with tight choke. Reaches further than other shotguns.", "double", P(5, 2), "Close", 2, 8, 3, "Large", LG, shape="cone")

# ------------------------------------------------------------------ Melee weapons (tools, Fight)
melee("Knife", "Short blade. Quiet and quick.", 2, "Small", ["Bleeding"])
melee("Dusters", "Brass knuckles. Blunt, fast, silent.", 2, "Small", notes="Blunt (Hornskin applies; never ignites an Immolator)")
melee("Heavy Knife", "A big blade with a heavy spine.", 3, "Medium", ["Bleeding"])
melee("Combat Axe", "Hatchet with a spike on the back.", 3, "Medium", ["Bleeding"], notes="Can be thrown with Tomahawk")
melee("Machete", "Long cane blade. Wide arcs.", 3, "Medium", ["Bleeding"])
melee("Cavalry Saber", "Curved steel. Reach and speed.", 3, "Medium", ["Bleeding"], notes="+1 to Fight defence against melee")
melee("Railroad Hammer", "A sledge found by the tracks. Slow, heavy, blunt.", 4, "Large", notes="Blunt (Hornskin applies). Found in the world, not bought")
melee("Shovel", "A tool first, a weapon when it has to be.", 2, "Medium", notes="Blunt. Found in the world")

# ------------------------------------------------------------------ Thrown weapons (tools, Throw)
thrown("Throwing Knives", "Four balanced blades. Silent.", P(2, 1), "Close", 4, ["Bleeding"], notes="Silent. Recovered after the fight")
thrown("Throwing Axes", "Two heavy axes. Loud when they land.", P(3, 2), "Close", 2, ["Bleeding"], notes="Recovered after the fight")
thrown("Throwing Spear", "One long spear. Pins what it hits.", P(4, 3), "Close", 1, ["Bleeding"], notes="Recovered after the fight")
bomb("Lantern", "thrown", "An oil lantern taken off a hook. Shatters and spreads fire where it lands.", 1, 3, ["Burning"], "Burning Ground", fire=True, img="explosive.svg", notes="Found in the world")
bomb("Fusee", "thrown", "A road flare. Lights the zone and sets fire to whatever it lands on. Three per pack.", 0, 2, ["Burning"], "Lit Up", fire=True, charges=3, img="explosive.svg", notes="Tool. Three charges")

# ------------------------------------------------------------------ Grenades (consumables, single use)
G = "grenade"
bomb("Dynamite Stick", G, "A short fuse and a big bang. Destroys light cover in the zone.", 4, 5, [], "Light Cover Blown Away")
bomb("Dynamite Bundle", G, "Three sticks tied together. Takes the walls with it.", 5, 7, [], "Cover Blown Away")
bomb("Big Dynamite Bundle", G, "Enough dynamite to drop a barn.", 6, 9, [], "Cover Blown Away", notes="Heavy: Throw difficulty +1")
bomb("Waxed Dynamite Stick", G, "Waterproof fuse: can be cooked (Sapper) and lit in the rain.", 4, 5, [], "Light Cover Blown Away", notes="Burns in water. Cooking the fuse never fails")
bomb("Frag Bomb", G, "Shrapnel tears through everyone in the zone.", 3, 6, ["Bleeding"], "")
bomb("Waxed Frag Bomb", G, "A frag bomb with a waterproof fuse.", 3, 6, ["Bleeding"], "", notes="Burns in water. Cooking the fuse never fails")
bomb("Sticky Bomb", G, "Thrown at a person (Throw vs Athletics). Whoever it sticks to gets no blast defence.", 4, 4, [], "", sticky=True)
bomb("Concertina Bomb", G, "Scatters razor wire across the zone.", 2, 4, ["Bleeding"], "Razor Wire (Athletics overcome to cross)")
bomb("Fire Bomb", G, "An incendiary flask. Fire kills ordinary monsters outright; hunters catch fire.", 1, 4, ["Burning"], "Burning Ground", fire=True)
bomb("Liquid Fire Bomb", G, "Burning oil that spreads: the fire covers a wider zone and lasts longer.", 1, 6, ["Burning"], "Burning Ground (lasts the scene)", fire=True)
bomb("Hellfire Bomb", G, "A heavy incendiary charge. Fire kills ordinary monsters outright; hunters catch fire.", 2, 6, ["Burning"], "Burning Ground", fire=True)
bomb("Hive Bomb", G, "A nest of hive insects. The swarm hunts whoever is in the zone.", 1, 5, ["Poisoned"], "Hive Swarm (−1 to all rolls until you leave)")
bomb("Poison Bomb", G, "A cloud of poison gas. No damage, but it lingers.", 0, 5, ["Poisoned"], "Poison Cloud (Poisoned each exchange you stay)")
bomb("Choke Bomb", G, "Thick choking smoke: −2 to all rolls in the zone, no Dark Sight. Puts out fires.", 0, 5, ["Blinded"], "Choking Smoke (−2 to all rolls, no Dark Sight)", notes="Extinguishes Burning Ground and Burning hunters in the zone")
bomb("Flash Bomb", G, "A blinding burst. No damage; everyone in the zone is Blinded.", 0, 5, ["Blinded"], "")
bomb("Chaos Bomb", G, "A string of firecrackers and gunshot sounds. Everyone hears a gunfight that isn't there.", 0, 1, [], "Gunfire Over There (Notice to tell it from a real fight)", notes="No damage: used to draw monsters and hunters")

# ------------------------------------------------------------------ Support items
# effect: heal = Health boxes cleared, unburn = Burned boxes cleared, cure = conditions cleared,
#         ammo = refill spare rounds of every firearm, text = effect to post in chat.
support("First Aid Kit", "Bandages, needle and thread. Three uses per mission.", "tool", 3,
        {"heal": 2, "cure": ["Bleeding", "Heavy Bleeding"], "text": "Clears 2 Health boxes and stops the bleeding. Takes your action (Physician: free once per exchange; Doctor: 4 boxes)."}, target="ally")
support("Vitality Shot", "A syringe of something that works. Instant.", "consumable", 1,
        {"heal": 2, "text": "Clears 2 Health boxes at once. Free action."})
support("Weak Vitality Shot", "Half a dose. Better than nothing.", "consumable", 1,
        {"heal": 1, "text": "Clears 1 Health box. Free action."})
support("Regeneration Shot", "Knits burned flesh back together. Restores a lost Health chunk over the scene.", "consumable", 1,
        {"heal": 1, "unburn": 1, "regen": 3, "text": "Restores 1 Burned chunk and clears 1 Health box, then 1 more box at the end of each of the next 3 exchanges (not while Poisoned)."})
support("Antidote Shot", "Neutralises poison and keeps it out for a while.", "consumable", 1,
        {"cure": ["Poisoned"], "text": "Cures Poisoned. Immune to Poisoned until the end of the scene (Hive swarms, poison clouds, Spider spit)."})
support("Weak Antidote Shot", "Cures the poison, nothing more.", "consumable", 1,
        {"cure": ["Poisoned"], "text": "Cures Poisoned."})
support("Stamina Shot", "Adrenaline and coca. You stop feeling your legs.", "consumable", 1,
        {"text": "Until the end of the scene: sprinting is a free action (move twice and still act), +1 to Athletics overcome rolls."})
support("Ammo Box", "A crate of common calibres. Refills spare rounds.", "consumable", 1,
        {"ammo": True, "text": "Spare rounds of every firearm you carry are refilled (Decoy Supply: decoys too)."})
support("Special Ammo Box", "Hand-loaded rounds: incendiary, poison, FMJ, high velocity or dumdum.", "consumable", 1,
        {"ammo": True, "text": "Refills spare rounds and lets you switch one weapon's ammo type (weapon settings)."})
support("Spyglass", "Brass telescope. Reads the far bank.", "tool", 0,
        {"text": "+2 to Notice to spot hunters or monsters at Long and Extreme range."})
support("Decoys", "Stones, bottles and bits of tin. Thrown to make noise somewhere else.", "tool", 3,
        {"text": "Throw into a zone up to two zones away: the zone gets the aspect Noise Over There (free invoke). Monsters and hunters without Notice turn toward it."})
support("Decoy Fuses", "Sparkling fuses that sound like lit dynamite.", "tool", 2,
        {"text": "Throw into a zone: everyone there must pass Will vs Fair (+2) or leave the zone this exchange."})
support("Concertina Trap", "A coil of razor wire that springs open when stepped on.", "tool", 1,
        {"text": "Place in your zone (Crafts, free action; Poacher: silent). The first to enter without Notice vs Fair (+2) takes 2 damage and Bleeding; the zone gets Razor Wire."}, target="self")
support("Poison Trap", "A hive-insect jar rigged to shatter.", "tool", 1,
        {"text": "Place in your zone (Crafts, free action; Poacher: silent). The first to enter without Notice vs Fair (+2) is Poisoned; the zone gets Poison Cloud."})
support("Alert Trip Mine", "A tripwire that fires a flare and a shriek.", "tool", 1,
        {"text": "Place in a zone exit (Crafts, free action). When triggered: everyone within three zones hears it, the zone is Lit Up."})
support("Bear Trap", "Iron jaws. Loud, slow, cruel.", "tool", 1,
        {"text": "Place in your zone (Crafts, free action). The first to enter without Notice vs Good (+3) takes 3 damage, Bleeding, and is Pinned until an Athletics overcome at Fair (+2)."})
support("Choke Beetle", "A beetle you guide by Dark Sight. Bursts into choking smoke on command.", "tool", 1,
        {"text": "Send it up to three zones away (Lore overcome vs Fair +2 to guide it past hunters). Detonate: the zone gets Choking Smoke (−2 to all rolls, no Dark Sight) and fires there go out."})
support("Stalker Beetle", "A beetle you guide by Dark Sight. Shows you what it sees.", "tool", 1,
        {"text": "Send it up to three zones away (Lore overcome vs Fair +2). You see what it sees: Notice as if you were in its zone. Burst it to mark one hunter (free invoke on Spotted)."})

out = pathlib.Path(__file__).resolve().parent.parent / "data" / "arsenal.json"
out.write_text(json.dumps(items, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
cats = {}
for i in items: cats[i["category"]] = cats.get(i["category"], 0) + 1
print(len(items), "items", cats)

# Hunt: Showdown RPG (Fate Core)

Unofficial tabletop adaptation of Hunt: Showdown for Foundry VTT v14, built on the **Fate Core Official** system. Free, made with the rights holder's authorization.

## Install

1. Install and enable the **Fate Core Official** system (4.7.14 or later).
2. Copy the `hunt-showdown-fco` folder into `Data/modules/`, then enable the module in your world.
3. On the next load, the GM is asked to install the Hunt rules. Accept: the page reloads.
4. Recreate your characters: actors created before the install keep the old Fate Core skills and tracks.

The install can be rerun at any time from **Game Settings → Hunt rules → Install / reinstall**.

## What it sets up (v0.10.0)

- **18 skills**: Athletics, Burglary, Crafts, Deceive, Empathy, Fight, Heal, Investigate, Lore, Notice, Physique, Provoke, Rapport, Resources, Shoot, Stealth, Throw, Will. Skill pyramid of 20 points, column rule enforced.
- **Tracks**: Health (6 boxes in 3 chunks), Burned (3), Dread (3), Mild / Moderate / Severe consequences, extra Mild at Physique Great (+4).
- **Conditions**: Bleeding, Heavy Bleeding, Burning, Poisoned, Pinned, Blinded, Shaken, Downed.
- **Aspects**: High Concept, Trouble, Archetype, Bloodline.
- **Stunts**: the seven archetype signature stunts.
- **Theme**: dark brown, parchment and brass sheet colours. On the Biography tab, Description and Biography sit side by side above the **Arsenal** (the Extras panel, renamed).
- **Arsenal**: 85 items in the Items directory (Hunt Arsenal folder): handguns, long guns, grenades, thrown and melee weapons, support items.
- **Bestiary**: 12 Stillwater monsters in the Actors directory (Hunt Bestiary folder).
- **Traits**: 45 trait cards in three decks, a hand for each player, and two piles (Cards directory, Hunt Traits folder).

## Arsenal

The Items directory gets a **Hunt Arsenal** folder with six sub-folders: **Handguns**, **Long Guns**, **Grenades & Bombs**, **Thrown Weapons**, **Melee Weapons** and **Support Items** — 85 items. Drag one onto a hunter. **Game Settings → Hunt arsenal** creates the missing items, or rewrites every arsenal item (in the directory and on characters) to the module's stats after a balance change.

A weapon is a Fate Core Extra with weapon data; its row in the Arsenal panel gets buttons and a summary line (skill, power per range band, best band marked *, ammo, weapon stress, notes).

- **Attack** (crosshairs): target a token first if you can. Choose range, cover, whether the target is aware (the module rolls their Athletics), aim and extra shots. The module rolls 4dF + skill, the defence, the ballistic die (twice on success with style) and the extra-shot dice, spends the ammo, adds weapon stress and posts the result.
- **Reload**: fills the weapon from its spare rounds. Thrown weapons with nothing spare are **recovered** instead (loaded back to full).
- **Clear jam** (wrench, when the weapon has stress): Crafts vs Fair (+2).
- **Weapon settings** (gun): turn any Extra into a weapon or edit it: skill, action, power per band, best band, capacity, spare rounds and what an ammo box refills them to, ammo type, reliability, slot, tool flag, notes.

Pinned, Shaken, Poisoned and Blinded on the attacker or defender are applied automatically.

**Apply damage**: when the attack had a targeted token and hits (or ties), the chat card has an **Apply** button. The target's owner (or the GM) picks which free consequences absorb part of the hit and names them; the rest marks Health boxes from the last unburned chunk backward. Conditions from the hit (Bleeding, Burning, Poisoned, Pinned) are ticked, Bleeding becomes Heavy Bleeding on a new hit, and damage that cannot be absorbed marks Downed. A summary goes to chat.

### Balance

Damage on a hit = shifts + power (+1 per extra-shot "+"), then the ballistic die (+2 Vital / −2 Graze). With Shoot Good (+3) against Athletics Fair (+2), a hit averages **power + 3** and lands about 58 % of the time, so a power-2 pistol takes half a hunter's Health per hit and a power-4 rifle nearly all of it — Hunt lethality. Weapons therefore differ mainly by **range bands**, **rounds**, **extra shots**, **reliability** and **slot**. `tools/balance.py` runs the simulation; expected damage per attack at the best band: Winfield 3.1 · Nagant 3.3 · Caldwell 3.6 · Vetterli 3.5 · Mosin 4.1 · Romero 3.8 · Sparks 4.7 · Nitro 5.5.

Power scale: 1 light (flare, fire) · 2 compact ammo · 3 medium ammo · 4 long ammo · 5 Sparks, big shotgun at Close · 6 Nitro Express.

### Handguns

| Weapon | Action | Power by band (* best) | Rounds | Rel. | Slot | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Nagant M1895 | DA revolver | C* 2 / M 2 | 7 +14 | 3 | Small |  |
| Nagant M1895 Officer | DA revolver | C* 2 / M 2 | 7 +14 | 2 | Small |  |
| Caldwell Conversion | SA revolver | C* 3 / M 2 | 6 +12 | 3 | Small |  |
| Caldwell Conversion Uppercut | SA revolver | C* 3 / M 3 / L 2 | 6 +12 | 2 | Small |  |
| Caldwell Pax | SA revolver | C* 3 / M 3 | 6 +12 | 3 | Small |  |
| Scottfield Model 3 | SA revolver | C* 3 / M 2 | 6 +12 | 3 | Small | Reload is a free action (once per exchange) |
| Bornheim No. 3 | semi-auto | C* 2 / M 1 | 5 +15 | 2 | Small |  |
| Dolch 96 | semi-auto | C 3 / M* 3 / L 2 | 10 +10 | 2 | Small |  |
| LeMat Mark II | DA revolver | C* 2 / M 2 | 9 +9 | 2 | Small | Once per load, fire the shotgun barrel instead: Close 3, cone |
| Sparks Pistol | single | C* 4 / M 3 / L 2 | 1 +10 | 1 | Small |  |
| Romero 77 Handcannon | single | C* 3 | 1 +8 | 3 | Small | cone |
| Caldwell Rival 78 Handcannon | double | C* 3 | 2 +8 | 3 | Medium | cone |
| Specter 1882 Compact | pump | C* 3 / M 1 | 3 +9 | 3 | Medium | cone |
| Quad Derringer | double | C* 2 | 4 +8 | 2 | tool | Tool: does not use a weapon slot |
| Flare Pistol | single | C* 1 / M 1 | 1 +2 | 2 | tool | Burning; Tool: does not use a weapon slot. The zone gets the aspect Lit Up |
| Hand Crossbow | single | C* 2 / M 2 | 1 +4 | 1 | tool | Tool: does not use a weapon slot. Silent: no Notice roll to hear it |

### Long guns

| Weapon | Action | Power by band (* best) | Rounds | Rel. | Slot | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Winfield M1873 | lever | C 2 / M* 2 / L 1 | 15 +15 | 3 | Large |  |
| Winfield M1873C | lever | C 2 / M* 2 | 8 +16 | 3 | Medium |  |
| Winfield 1876 Centennial | lever | C 3 / M* 3 / L 2 | 10 +10 | 3 | Large |  |
| Springfield 1866 | single | C 3 / M* 3 / L 2 | 1 +12 | 4 | Medium |  |
| Vetterli 71 Karabiner | bolt | C 3 / M* 3 / L 3 | 6 +12 | 3 | Medium |  |
| Mosin-Nagant M1891 | bolt | C 3 / M 4 / L* 4 / E 3 | 5 +10 | 3 | Large |  |
| Lebel 1886 | bolt | C 3 / M 4 / L* 4 / E 3 | 8 +8 | 2 | Large |  |
| Krag 1896 | bolt | C 3 / M 4 / L* 4 / E 3 | 5 +10 | 2 | Large | Reload is a free action (once per exchange) |
| Martini-Henry IC1 | single | C 3 / M* 4 / L 4 | 1 +12 | 2 | Large |  |
| Sparks LRR | single | C 4 / M 5 / L* 5 / E 5 | 1 +10 | 1 | Large |  |
| Mosin-Nagant Avtomat | semi-auto | C 3 / M* 4 / L 3 | 15 +15 | 1 | Large |  |
| Nitro Express | double | C* 6 / M 6 / L 5 | 2 +4 | 1 | Large | Ignores 1 point of armour |
| Drilling | double | C 3 / M* 3 / L 3 | 1 +10 | 2 | Large | Also carries 2 shotgun shells: Close 4, cone; swap barrels as a free action |
| Bomb Lance | single | C* 5 / M 2 | 1 +3 | 1 | Large | Bleeding; Melee with Fight: Close 3 |
| Hunting Bow | single | C 3 / M* 3 / L 2 | 1 +10 | 4 | Large | Silent. Arrows are recovered after the fight (Bolt Seer: always) |
| Crossbow | single | C 4 / M* 4 / L 3 | 1 +6 | 4 | Large | Silent. Bolts are recovered after the fight (Bolt Seer: always) |
| Romero 77 | single | C* 4 / M 1 | 1 +10 | 3 | Large | cone |
| Caldwell Rival 78 | double | C* 4 / M 1 | 2 +10 | 3 | Large | cone |
| Specter 1882 | pump | C* 4 / M 1 | 5 +10 | 3 | Large | cone |
| Terminus | lever | C* 4 / M 1 | 6 +12 | 2 | Large | cone |
| Crown & King | semi-auto | C* 3 / M 1 | 5 +10 | 2 | Large | cone |
| Slate | double | C* 5 / M 2 | 2 +8 | 3 | Large | cone |

### Melee weapons (tools, Fight)

| Weapon | Power | Size | Notes |
| --- | --- | --- | --- |
| Knife | 2 | Small | Bleeding |
| Dusters | 2 | Small | Blunt (Hornskin applies) |
| Heavy Knife | 3 | Medium | Bleeding |
| Combat Axe | 3 | Medium | Bleeding; Can be thrown with Tomahawk |
| Machete | 3 | Medium | Bleeding |
| Cavalry Saber | 3 | Medium | Bleeding; +1 to Fight defence against melee |
| Railroad Hammer | 4 | Large | Blunt (Hornskin applies). Found in the world, not bought |
| Shovel | 2 | Medium | Blunt. Found in the world |

### Thrown weapons (tools, Throw)

| Weapon | Power / range | Notes |
| --- | --- | --- |
| Throwing Knives | C* 2 / M 1, 4 carried | Bleeding; Silent. Recovered after the fight |
| Throwing Axes | C* 3 / M 2, 2 carried | Bleeding; Recovered after the fight |
| Throwing Spear | C* 4 / M 3, 1 carried | Bleeding; Recovered after the fight |
| Lantern | fire, radius 3 m, 1 charge(s) | Burning; Found in the world |
| Fusee | fire, radius 2 m, 3 charge(s) | Burning; Tool. Three charges |

If the sheet stays white for a player, they have a personal colour scheme: in the sheet's customisation dialog, revert to the world default.

## Traits

Traits are cards, sorted into three decks by cost: **Tier I** (cost 1–3, found in marked caches), **Tier II** (4–5, taken from elite monsters) and **Tier III** (6–8, won from the Bounty).

- Each player has a **hand** (Traits — player name): the traits their hunter holds, **4 at most**. Drawing into a full hand is refused: discard one first.
- To find a trait, draw from the deck of the right tier into your hand (or the GM deals one). For the starting trait, the GM can drag the chosen card from the deck onto the player's hand.
- To **use** a trait, play it to **Played Traits**: its effect is posted to chat and the card **stays in your hand**. Active traits (red band) spend 1 Fate point from your assigned character; triggered traits cost nothing.
- To drop a trait, pass it to **Discarded Traits**.
- Hands for new players are created when the GM loads the world, or from **Game Settings → Hunt traits**.

## Monsters

Monsters are Fate Core characters with monster data: a category (Grunt, Elite, Boss), a **dread** rating, **armour**, **vital hit kills** or **vital pierces armour**, **volatile**, **immunities**, and for bosses **phases**. Their attacks are Extras with a natural attack (no ammo, no jams), fired with the same crosshairs button as hunters' weapons.

The sheet shows a banner with the monster's tags and, for bosses, a **phase** selector (Idle, Attack, Rage, Pursuit by default). The phase's attack and defence bonuses apply to rolls automatically; a phase change is whispered to the GM.

When damage is applied:
- to a monster: armour reduces non-Vital hits, a Vital hit kills monsters with "vital hit kills" outright, immunities drop the matching conditions, and a killed monster gets the dead status;
- to a hunter hit by a monster: the module rolls Will against the monster's dread; a failure marks a Dread box, and the third marks Shaken.

### Starter bestiary (values to playtest)

| Monster | Type | Health | Armour | Dread | Notes |
| --- | --- | --- | --- | --- | --- |
| Grunt | Grunt | 2 | – | 1 | Horde: +1 attack per extra Grunt (max +2) |
| Hive | Elite | 4 | – | 2 | Vital hit kills; Swarm (Close/Medium) poisons |
| Armored | Elite | 10 | 4 | 2 | A Vital hit pierces the armour (pistols barely scratch it) |
| Meathead | Elite | 18 | 1 | 3 | Blind (+2 Stealth against it), leeches, fireproof |
| Immolator | Elite | 4 | – | 2 | Vital hit kills; immune to Burning; **volatile**: bullets, blades, arrows and blasts that don't kill it set it ablaze |
| Hellhound | Elite | 3 | – | 2 | Moves two zones; pack bonus |
| Water Devil | Elite | 4 | – | 2 | Deep Water only, submerged |
| The Butcher | Boss | 10 + consequences | – | 4 | Fight 3; Meat Hook (2), Burning Hammer (1), Fire Breath |
| The Spider | Boss | 8 + consequences | – | 4 | Fight 3; Fangs (2), Poison Spit (1); immune to Poisoned; wall crawler |
| The Assassin | Boss | 8 + consequences | – | 4 | Fight 3; Blade Claws (2); clones |
| Scrapbeak | Boss | 10 + consequences | 1 | 4 | Fight 3; Anchor Swing (2); steals items |
| Rotjaw | Boss | 10 + consequences | – | 4 | Fight 3; Bite (2); submerged, breaches to attack |

### Monster Creator

GM only: the **Monster Creator** button at the top of the Actors directory (or Game Settings → Monster Creator). Start blank or from a bestiary entry, then set skills, Health, armour, dread, consequences, vital hit kills, immunities, up to three attacks (skill, power, range, conditions on hit), up to three abilities, and for bosses the four phases. The monster is created in the Hunt Bestiary folder and its sheet opens.

Boss tuning target: a boss hit averages about 5 damage, so one hit leaves a fresh hunter on their last box and a second one downs them, unless they absorb with a consequence. **Game Settings → Hunt bestiary** can create missing monsters or rebuild the whole bestiary from the module's data.

## Explosives

Explosives are items too (Extras) and they are **single use**: once thrown, the item leaves the sheet. Carry two fire bombs, carry two items. Their button is a **bomb**:

1. **Throw**: choose the target zone (same zone Average +1, adjacent Fair +2, two zones Great +4 with Pitcher). Throw vs that difficulty. On a failure, the scatter die says where it lands (+ one zone beyond, 0 short, − in the thrower's zone). A **sticky** bomb is thrown at one targeted token instead (Throw vs their Athletics).
2. **Detonate** (button on the throw card): **click the impact point on the map** (right click or Escape cancels). A sticky bomb goes off on the token it stuck to, no click needed. Every token within the **blast radius** is caught, **friend or foe, the thrower included**; tokens in the outer half of the radius take −2 power. The circle flashes on the map for a few seconds. Each victim defends with Athletics against the throw result (Fair +2 if the throw failed) and gets their own Apply button. Hidden tokens are only caught when the GM detonates.

Radii are in metres; on a scene measured in feet they are converted. Each explosive's radius can be changed in its settings (gun button).

| Explosive | Power | Radius | Effect |
| --- | --- | --- | --- |
| Dynamite Stick | 4 | 5 m | Light Cover Blown Away |
| Dynamite Bundle | 5 | 7 m | Cover Blown Away |
| Big Dynamite Bundle | 6 | 9 m | Cover Blown Away, Heavy: Throw difficulty +1 |
| Waxed Dynamite Stick | 4 | 5 m | Light Cover Blown Away, Burns in water. Cooking the fuse never fails |
| Frag Bomb | 3 | 6 m | Bleeding |
| Waxed Frag Bomb | 3 | 6 m | Bleeding, Burns in water. Cooking the fuse never fails |
| Sticky Bomb | 4 | 4 m | sticky |
| Concertina Bomb | 2 | 4 m | Bleeding, Razor Wire (Athletics overcome to cross) |
| Fire Bomb | 1 | 4 m | fire, Burning, Burning Ground |
| Liquid Fire Bomb | 1 | 6 m | fire, Burning, Burning Ground (lasts the scene) |
| Hellfire Bomb | 2 | 6 m | fire, Burning, Burning Ground |
| Hive Bomb | 1 | 5 m | Poisoned, Hive Swarm (−1 to all rolls until you leave) |
| Poison Bomb | 0 | 5 m | Poisoned, Poison Cloud (Poisoned each exchange you stay) |
| Choke Bomb | 0 | 5 m | Blinded, Choking Smoke (−2 to all rolls, no Dark Sight), Extinguishes Burning Ground and Burning hunters in the zone |
| Flash Bomb | 0 | 5 m | Blinded |
| Chaos Bomb | 0 | 1 m | Gunfire Over There (Notice to tell it from a real fight), No damage: used to draw monsters and hunters |

**Power 0 explosives** (Flash, Poison, Choke, Chaos, Hive) do no damage: whoever is caught only gets the conditions and the zone aspect. Dead monsters are never caught again.

**Fire**: any fire hit (fire bombs, and any hit that inflicts Burning, incendiary ammo included) **kills ordinary monsters outright**. Bosses, fireproof monsters (the Meathead) and monsters immune to Burning (the Immolator) take the damage normally. The monster banner shows "Fire kills" or "Fireproof".

## Support items

Support items are Extras with support data: **tools** keep their charges (First Aid Kit: 3 uses; Spyglass: unlimited), **consumables** leave the sheet once used. Their row gets a **Use** button (hand with a cross): the module clears Health boxes, restores Burned chunks, cures conditions or refills spare rounds, spends the charge and posts the effect to chat. The First Aid Kit can be used on a targeted ally in the zone; **Doctor** doubles its boxes. The **support settings** button (kit) turns any Extra into a support item.

| Item | Kind | Effect |
| --- | --- | --- |
| First Aid Kit | tool, 3 uses | Clears 2 Health boxes and stops the bleeding. Takes your action (Physician: free once per exchange; Doctor: 4 boxes). |
| Vitality Shot | consumable | Clears 2 Health boxes at once. Free action. |
| Weak Vitality Shot | consumable | Clears 1 Health box. Free action. |
| Regeneration Shot | consumable | Restores 1 Burned chunk and clears 1 Health box. For the rest of the scene, clear 1 more Health box at the end of each exchange. |
| Antidote Shot | consumable | Cures Poisoned. Immune to Poisoned until the end of the scene (Hive swarms, poison clouds, Spider spit). |
| Weak Antidote Shot | consumable | Cures Poisoned. |
| Stamina Shot | consumable | Until the end of the scene: sprinting is a free action (move twice and still act), +1 to Athletics overcome rolls. |
| Ammo Box | consumable | Spare rounds of every firearm you carry are refilled (Decoy Supply: decoys too). |
| Special Ammo Box | consumable | Refills spare rounds and lets you switch one weapon's ammo type (weapon settings). |
| Spyglass | tool | +2 to Notice to spot hunters or monsters at Long and Extreme range. |
| Decoys | tool, 3 uses | Throw into a zone up to two zones away: the zone gets the aspect Noise Over There (free invoke). Monsters and hunters without Notice turn toward it. |
| Decoy Fuses | tool, 2 uses | Throw into a zone: everyone there must pass Will vs Fair (+2) or leave the zone this exchange. |
| Concertina Trap | tool | Place in your zone (Crafts, free action; Poacher: silent). The first to enter without Notice vs Fair (+2) takes 2 damage and Bleeding; the zone gets Razor Wire. |
| Poison Trap | tool | Place in your zone (Crafts, free action; Poacher: silent). The first to enter without Notice vs Fair (+2) is Poisoned; the zone gets Poison Cloud. |
| Alert Trip Mine | tool | Place in a zone exit (Crafts, free action). When triggered: everyone within three zones hears it, the zone is Lit Up. |
| Bear Trap | tool | Place in your zone (Crafts, free action). The first to enter without Notice vs Good (+3) takes 3 damage, Bleeding, and is Pinned until an Athletics overcome at Fair (+2). |
| Choke Beetle | tool | Send it up to three zones away (Lore overcome vs Fair +2 to guide it past hunters). Detonate: the zone gets Choking Smoke (−2 to all rolls, no Dark Sight) and fires there go out. |
| Stalker Beetle | tool | Send it up to three zones away (Lore overcome vs Fair +2). You see what it sees: Notice as if you were in its zone. Burst it to mark one hunter (free invoke on Spotted). |

### Tools and consumables

As in Hunt, a hunter carries **4 tools** (melee and thrown weapons, derringer, flare pistol, hand crossbow, kits, traps, beetles) and **4 consumables** (explosives, shots, ammo boxes). They don't use weapon slots. The loadout line counts them; dropping a fifth warns but is allowed (things picked up in the field).

## End of exchange: ongoing damage

At the end of every exchange, every token on the scene suffers its ongoing conditions. It runs **automatically when the Combat Tracker moves to the next round**, or by hand with the **End of Exchange** macro (Macros directory, Hunt folder) or `game.hunt.endOfExchange()`. GM only; one chat card sums it up.

| Condition | Each exchange | Ends |
| --- | --- | --- |
| Bleeding | 1 damage | First Aid Kit. A new hit turns it into Heavy Bleeding (not with Bloodless) |
| Heavy Bleeding | 2 damage | First Aid Kit |
| Poisoned | 1 damage, −1 to all rolls, Health boxes **cannot be cleared** (kits and shots heal nothing) | Antidote; Mithridatist ends it at the end of the exchange |
| Burning | 1 Health box; when that empties a chunk, the chunk **burns away** (Burned) | Athletics overcome vs Fair (+2), water, choke smoke — untick it on the sheet |
| Regeneration (shot) | clears 1 Health box for 3 exchanges (not while Poisoned) | — |

Damage over time marks Health from the last unburned chunk backward; what cannot be absorbed marks **Downed**. Ordinary monsters that are Burning die (bosses, fireproof monsters and the Immolator don't). Downed hunters and dead monsters are skipped.

### The Immolator

The Immolator is **volatile**: when a bullet, blade, arrow or blast hits it **without killing it**, it bursts into flame. A fire burst (power 2, radius 4 m, Athletics vs Good +3) catches everyone around it, friend or foe, with Burning; its zone gains Burning Ground; it stays **ablaze**, and at each end of exchange it sets fire to everyone within 2 m. Blunt weapons (dusters, hammer, shovel), fire and choke smoke don't set it off. A Vital hit kills it cleanly — aim for the head. Any monster can be made volatile in the Monster Creator; any weapon can be marked **blunt** in its settings.

## Attack shapes

Every weapon and monster attack has a **Shape**: Single target (default), **Area** (everyone in a zone) or **Cone** (everyone in front of the attacker, in range). **Shotguns fire in a cone** (the Romero 77). Explosives have no shape setting: they always blast their zone. Area and Cone attacks make one roll; every targeted token defends with Athletics, a tie leaves them Pinned, and each hit has its own Apply button. Spread attacks don't roll the ballistic die. Extra shots work as for single shots (second barrel, pump, lever): each + adds 1 power for everyone hit, each − adds weapon stress. Set the shape in the weapon settings (gun button) or in the Monster Creator; the Butcher's Fire Breath is a cone too.

## Loadout

Only **equipped** weapons can fire. A weapon is equipped when its Extra is toggled on (the toggle on its row in the Extras panel); holstered weapons show greyed out, without attack or reload buttons.

Slots work as in Hunt: **Small 1, Medium 2, Large 3**, a budget of **4 slots** (5 with **Quartermaster**, as a trait card in the player's hand or a stunt) and **two weapons** at most. Equipping a weapon that doesn't fit is refused with the reason; a weapon dropped on a hunter that doesn't fit arrives holstered. The top of the Arsenal panel shows the current loadout, tools and consumables. Explosives, tools and monster attacks don't use slots.

Hunters who already had more weapons toggled on before 0.7.0 keep them until they toggle one off.

## Hunter Creator

Open it from the **Hunter Creator** button at the top of the Actors directory (a new hunter), or from the banner at the top of a hunter's sheet (rebuild that hunter). Players who can't create actors get their assigned character.

1. **Name and archetype**: Scout, Brute, Gunslinger, Field Medic, Mystic, Scavenger, Sapper, or **Custom**.
2. **Skills**: the Fate pyramid on 20 points (one Great +4, two Good +3, three Fair +2, four Average +1). An archetype **fixes its Great and its two Goods** automatically; the player picks the rest. Custom picks everything. A skill can't be picked twice. Consequences linked to skills (extra Mild at Physique +4) update by themselves.
3. **Aspects**: High Concept, Trouble, Archetype, Bloodline.
4. **Signature stunt**: added automatically for an archetype; Custom chooses one of the seven, or none.
5. **Starting trait**: one card from the archetype's affinity list (Custom: any Tier I trait), moved from its deck into the player's trait hand. Cards already taken are greyed out.

| Archetype | Great (+4) | Good (+3) | Signature stunt | Affinity traits |
| --- | --- | --- | --- | --- |
| Scout | Notice | Stealth, Athletics | Pathfinder | Greyhound, Lightfoot, Vigilant, Gator Legs |
| Brute | Fight | Physique, Provoke | Unbreakable | Hornskin, Kiteskin, Tomahawk, Ghoul |
| Gunslinger | Shoot | Athletics, Notice | Quick Draw | Fanning, Levering, Ambidextrous, Iron Repeater |
| Field Medic | Heal | Empathy, Will | Field Surgery | Physician, Doctor, Bloodless, Necromancer |
| Mystic | Lore | Will, Investigate | Attuned | Serpent, Conduit, Beastface, Mithridatist |
| Scavenger | Resources | Burglary, Crafts | Pack Rat | Packmule, Vulture, Frontiersman, Bulletgrubber |
| Sapper | Throw | Crafts, Physique | Cooked Fuse | Pitcher, Dauntless, Bulwark, Poacher |

Rebuilding a hunter replaces its skills, its four aspects and its signature stunt; its weapons, tracks already marked and other stunts are kept.

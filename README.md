# Hunt: Showdown RPG (Fate Core)

Unofficial tabletop adaptation of Hunt: Showdown for Foundry VTT v14, built on the **Fate Core Official** system. Free, made with the rights holder's authorization.

## Install

1. Install and enable the **Fate Core Official** system (4.7.14 or later).
2. Copy the `hunt-showdown-fco` folder into `Data/modules/`, then enable the module in your world.
3. On the next load, the GM is asked to install the Hunt rules. Accept: the page reloads.
4. Recreate your characters: actors created before the install keep the old Fate Core skills and tracks.

The install can be rerun at any time from **Game Settings → Hunt rules → Install / reinstall**.

## What it sets up (v0.9.0)

- **18 skills**: Athletics, Burglary, Crafts, Deceive, Empathy, Fight, Heal, Investigate, Lore, Notice, Physique, Provoke, Rapport, Resources, Shoot, Stealth, Throw, Will. Skill pyramid of 20 points, column rule enforced.
- **Tracks**: Health (6 boxes in 3 chunks), Burned (3), Dread (3), Mild / Moderate / Severe consequences, extra Mild at Physique Great (+4).
- **Conditions**: Bleeding, Heavy Bleeding, Burning, Poisoned, Pinned, Blinded, Shaken, Downed.
- **Aspects**: High Concept, Trouble, Archetype, Bloodline.
- **Stunts**: the seven archetype signature stunts.
- **Theme**: dark brown, parchment and brass sheet colours.
- **Weapons and explosives**: seven sample weapons and seven explosives in the Items directory (Hunt Arsenal folder).
- **Bestiary**: 12 Stillwater monsters in the Actors directory (Hunt Bestiary folder).
- **Traits**: 45 trait cards in three decks, a hand for each player, and two piles (Cards directory, Hunt Traits folder).

## Weapons

A weapon is a Fate Core Extra with weapon data. Drag one from the Hunt Arsenal folder onto a character: its row in the Extras panel gets buttons and a summary line (skill, power per range band, best band marked *, ammo, weapon stress).

- **Attack** (crosshairs): target a token first if you can. Choose range, cover, whether the target is aware (the module rolls their Athletics), aim and extra shots. The module rolls 4dF + skill, the defence, the ballistic die (twice on success with style) and the extra-shot dice, spends the ammo, adds weapon stress and posts the result.
- **Reload**: fills the weapon from its spare rounds.
- **Clear jam** (wrench, when the weapon has stress): Crafts vs Fair (+2).
- **Weapon settings** (gun): turn any Extra into a weapon or edit it: skill, action, power per band, best band, capacity, ammo type, reliability, slot.

Pinned, Shaken, Poisoned and Blinded on the attacker or defender are applied automatically.

**Apply damage**: when the attack had a targeted token and hits (or ties), the chat card has an **Apply** button. The target's owner (or the GM) picks which free consequences absorb part of the hit and names them; the rest marks Health boxes from the last unburned chunk backward. Conditions from the hit (Bleeding, Burning, Poisoned, Pinned) are ticked, Bleeding becomes Heavy Bleeding on a new hit, and damage that cannot be absorbed marks Downed. A summary goes to chat.

The sample weapons can be recreated from **Game Settings → Hunt arsenal**.

If the sheet stays white for a player, they have a personal colour scheme: in the sheet's customisation dialog, revert to the world default.

## Not yet included

Melee weapons, the full arsenal.

## Traits

Traits are cards, sorted into three decks by cost: **Tier I** (cost 1–3, found in marked caches), **Tier II** (4–5, taken from elite monsters) and **Tier III** (6–8, won from the Bounty).

- Each player has a **hand** (Traits — player name): the traits their hunter holds, **4 at most**. Drawing into a full hand is refused: discard one first.
- To find a trait, draw from the deck of the right tier into your hand (or the GM deals one). For the starting trait, the GM can drag the chosen card from the deck onto the player's hand.
- To **use** a trait, play it to **Played Traits**: its effect is posted to chat and the card **stays in your hand**. Active traits (red band) spend 1 Fate point from your assigned character; triggered traits cost nothing.
- To drop a trait, pass it to **Discarded Traits**.
- Hands for new players are created when the GM loads the world, or from **Game Settings → Hunt traits**.

## Monsters

Monsters are Fate Core characters with monster data: a category (Grunt, Elite, Boss), a **dread** rating, **armour**, **vital hit kills**, **immunities**, and for bosses **phases**. Their attacks are Extras with a natural attack (no ammo, no jams), fired with the same crosshairs button as hunters' weapons.

The sheet shows a banner with the monster's tags and, for bosses, a **phase** selector (Idle, Attack, Rage, Pursuit by default). The phase's attack and defence bonuses apply to rolls automatically; a phase change is whispered to the GM.

When damage is applied:
- to a monster: armour reduces non-Vital hits, a Vital hit kills monsters with "vital hit kills" outright, immunities drop the matching conditions, and a killed monster gets the dead status;
- to a hunter hit by a monster: the module rolls Will against the monster's dread; a failure marks a Dread box, and the third marks Shaken.

### Starter bestiary (values to playtest)

| Monster | Type | Health | Armour | Dread | Notes |
| --- | --- | --- | --- | --- | --- |
| Grunt | Grunt | 2 | – | 1 | Horde: +1 attack per extra Grunt (max +2) |
| Hive | Elite | 4 | – | 2 | Vital hit kills; Swarm (Close/Medium) poisons |
| Armored | Elite | 5 | 2 | 2 | Vital hit kills |
| Meathead | Elite | 8 | – | 3 | Blind (+2 Stealth against it), leeches |
| Immolator | Elite | 4 | – | 2 | Vital hit kills; immune to Burning; ignites its zone |
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
| Dynamite Stick | 4 | 5 m | Blows away light cover |
| Frag Bomb | 3 | 6 m | Bleeding |
| Concertina Bomb | 2 | 4 m | Bleeding, Razor Wire on the zone |
| Fire Bomb | 1 | 4 m | Fire: Burning, Burning Ground |
| Hellfire Bomb | 2 | 6 m | Fire: Burning, Burning Ground |
| Sticky Bomb | 4 | 4 m | Sticks to one target, who gets no defence |
| Choke Bomb | 0 | 5 m | Blinded, Choking Smoke on the zone |

**Fire**: any fire hit (fire bombs, and any hit that inflicts Burning, incendiary ammo included) **kills ordinary monsters outright**. Bosses, fireproof monsters (the Meathead) and monsters immune to Burning (the Immolator) take the damage normally. The monster banner shows "Fire kills" or "Fireproof".

## Attack shapes

Every weapon and monster attack has a **Shape**: Single target (default), **Area** (everyone in a zone) or **Cone** (everyone in front of the attacker, in range). **Shotguns fire in a cone** (the Romero 77). Explosives have no shape setting: they always blast their zone. Area and Cone attacks make one roll; every targeted token defends with Athletics, a tie leaves them Pinned, and each hit has its own Apply button. Spread attacks don't roll the ballistic die. Set the shape in the weapon settings (gun button) or in the Monster Creator; the Butcher's Fire Breath is a cone too.

## Loadout

Only **equipped** weapons can fire. A weapon is equipped when its Extra is toggled on (the toggle on its row in the Extras panel); holstered weapons show greyed out, without attack or reload buttons.

Slots work as in Hunt: **Small 1, Medium 2, Large 3**, a budget of **4 slots** (5 with **Quartermaster**, as a trait card in the player's hand or a stunt) and **two weapons** at most. Equipping a weapon that doesn't fit is refused with the reason; a weapon dropped on a hunter that doesn't fit arrives holstered. The top of the Extras panel shows the current loadout. Explosives and monster attacks don't use slots.

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

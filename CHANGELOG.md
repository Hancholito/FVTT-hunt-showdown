# Changelog

## 0.15.0
- Three new creatures. **Drowned** (Grunt, packs): wait Submerged in deep water (hidden, +2 defence), rise to Drag Under (Pinned, 1 drowning damage per exchange in deep water until freed), fireproof while soaked. **The Hanged** (Elite): lurks in rafters and trees (Stealth 4), drops on a lone hunter and hoists them (Pinned, Fight −2), a Vital hit to the neck kills it. **The Chanter** (Elite): leads a choir of Grunts; its Hymn makes every hunter within 15 m roll Will vs Good (+3) each exchange or be Shaken and drawn toward it; kill it and the choir breaks.
- Monster auras: a monster can make every hunter within a radius roll a skill each exchange, with a condition on a failure (run by End of Exchange).
- A tie against a cloud with no damage (spores, smoke, flash) is a miss, not Pinned.
- Alarm message names the token only when it differs from the animal type.

## 0.14.1
- Animal alarms trigger on the movement's destination: in Foundry v14 a token's position follows its movement animation, so the check ran on the old position and could miss the alarm.

## 0.14.0
- Animal alarms: crows, chicken coops, dog kennels, ducks, horses and cows as tokens. A player moving a hunter within an animal's radius chooses: crouch past (Stealth vs its difficulty), run past, or Beastface. When it goes off, its spot is pinged on everyone's map and a public message tells the table; monsters with a Triggered phase within earshot (the Flayed) switch to it and the GM is told. Crows and ducks fly off once and vanish (the GM can reset them); the others go off again when a hunter comes back. Radius, difficulty, range and an optional sound per alarm.
- Lore Creator: Animal alarm. New compendium Hunt: Alarms (the six animals). Rules journal: Animal alarms.

## 0.13.2
- New monster: the **Myconid** (Elite), a man gone to mould. Health 10, armour 2 (a Vital hit ignores it), Athletics −1, slow. Slam (Fight 2, power 2) and Spore Breath (cone, no damage, Poisoned). When it dies, a spore cloud bursts 4 m around it (Athletics vs Good +3 or Poisoned, Spore Cloud zone) — unless fire killed it: fire kills it outright and leaves no cloud.
- Monsters can have a death burst (any monster data: label, radius, attack, power, conditions, zone aspect, not when burned); it also goes off when bleeding or poison kill the monster at the end of the exchange.

## 0.13.1
- New monster: the **Flayed** (Elite). Skinless, blind, forearms ending in bone spikes. Health 2, Athletics +2, Fight +3, Notice +4 (hearing), dread 3, immune to Blinded. Wandering phase (slow, moaning, defence −1), Triggered phase (+1 attack, charges two zones and attacks; Will vs dread for hunters in the zone). Bone Spikes: power 1, every hit Bleeding — about 3.4 damage per attack, it dies in one or two hits. Added to the world's bestiary on update and to the compendium.
- Any monster can now have phases (not only bosses); a monster can start in a given phase.
- The key button warns when no GM is connected (the unlock needs the GM's client).

## 0.13.0
- Lore items: newspaper clipping, handwritten note, book (pages to turn), photograph (turn it over), child's toy, wax cylinder (transcript and audio: Listen, or Play for the table), Pony Express missive (envelope, open the letter), key. Period handouts; Read button on the sheet; Show to everyone; Lore Creator in the Items directory. No slot, no limit.
- Locks: door walls get a Lock ID and a pick difficulty (Wall configuration). Containers (chest, desk, footlocker, safe) are actors on the map with a lock and contents. A key opens the matching door or container; without it, Burglary vs the difficulty (Fair +2 by default). Search button on the hunter's loadout line; Take or Take everything moves items to the hunter. The GM's client does the unlocking and moving through the module socket.
- Compendiums Hunt: Lore (a template of each kind and eight Stillwater examples that tell one story) and Hunt: Containers (templates, the locked Reeker Office Desk and the Doyle Footlocker, filled). Rules journal: Lore, keys and containers page.

## 0.12.2
- Beetles are played as tokens: Use the Stalker or Choke Beetle, click where it lands (up to 40 m), and a beetle token owned by the player appears with its own sight through the fog of war (Stalker 15 m, Choke 8 m), to find rival hunters. The player moves it; it lives 3 exchanges (counted down by End of Exchange). Burst (Stalker): targeted hunters within its sight are Spotted (eye icon). Release (Choke): Blinded and Choking Smoke 5 m around it. Recall. The GM's client creates the token through the module socket.
- Existing beetle items are updated on load.

## 0.12.1
- Balance pass with a full damage simulation (every weapon against every monster and a hunter, `tools/balance_full.py`). Weapons stay as they are: a hunter goes down in about 3 pistol attacks, 2.5 rifle attacks, 2 with the Nitro.
- Bosses evened out: the Spider took 12–15 attacks (Athletics +4) while the Butcher took 4. Butcher Health 13 and Athletics +2, Spider Athletics +3, Rotjaw Health 12. Every boss now takes about 6–7 rifle attacks or 7–9 pistol attacks.
- Meathead and Water Devil fight at +2 (was +3): they hit harder than the bosses. On update, the GM is asked to rebuild these five monsters; the compendium is updated.

## 0.12.0
- Compendiums, in a "Hunt: Showdown RPG" folder: **Hunt: Rules** (journal: welcome, Fate Core in five minutes with links to the official SRD and the Fate Core Official documentation, Fate points, hunters, health and harm, combat, explosives, support items, monsters, bestiary, traits, arsenal tables), **Hunt: Arsenal** (85 items in six folders), **Hunt: Bestiary** (12 monsters by category), **Hunt: Traits** (the three decks), **Hunt: Macros**.
- Fate points: a **Fate point** button on single-target attack cards. The attacker (attack) or the aware target (defence) invokes an aspect for +2 or a reroll, paid from the sheet (or a free invoke); a new card replaces the old one, whose Apply button is disabled.
- **Start of Mission** macro: every player's hunter goes back to their Fate point refresh (3). Refresh is per mission, not per session.
- Rules decided: invoke = +2 or reroll; rival compel in the same compound: the compeller pays 1 FP, the rival accepts and takes it or refuses and pays 1.

## 0.11.3
- Utility bombs do no damage: power 0 explosives (Flash, Poison, Choke, Chaos, Hive) only apply their conditions and zone aspect ("Caught"). The Hive Bomb drops to power 0 (existing copies are updated).
- Dead monsters are no longer caught again by blasts, cones and area attacks.
- Cone and area weapons get extra shots: the second barrel of the Rival 78 and Slate, pump and lever shotguns. Each + adds 1 power for everyone hit, each − adds weapon stress, rounds are spent.
- First Aid Kit on a targeted ally works even when both tokens come from the same actor.

## 0.11.2
- Monsters die when their last Health box is marked (they only died on overflow, so a 4-damage hit left a 4-box Immolator standing — and ablaze). Hunters still go down on overflow.
- The ablaze aura line names who is already burning instead of saying nobody is close.

## 0.11.1
- End of exchange now runs when anyone advances the Combat Tracker round (it only ran when the main GM clicked). The active GM's client runs it once; going back a round or starting the combat doesn't trigger it.
- An ignited Immolator shows the burning status icon on its token.

## 0.11.0
- End of exchange: Bleeding (1), Heavy Bleeding (2), Poisoned (1) and Burning (1 box, burns the chunk it empties) deal their damage to every token on the scene, automatically when the Combat Tracker advances a round, or with the End of Exchange macro (Hunt macro folder). Overflow marks Downed; burning ordinary monsters die. One chat card per exchange.
- Poisoned blocks healing: kits and shots clear no Health box while Poisoned. Regeneration Shot now regenerates 1 box per exchange for 3 exchanges.
- Volatile monsters: the Immolator bursts into flame when a bullet, blade, arrow or blast hits it without killing it — fire burst (power 2, 4 m, Burning) on everyone around, Burning Ground, and it stays ablaze, setting fire to anyone within 2 m each exchange. Blunt weapons don't set it off (new Blunt weapon option: Dusters, Railroad Hammer, Shovel). Monster Creator: Volatile option.
- Armored: Health 10, armour 4, a Vital hit pierces its armour instead of killing it (new "Vital pierces armour" option). Meathead: Health 18, armour 1. About 3–4 pistol hits or 2–3 rifle hits for the Armored, 3–4 rifle hits for the Meathead.
- On update, the GM is asked to rebuild the Immolator, the Armored and the Meathead and to refresh the arsenal. Reinstalling the rules updates the Bleeding, Burning and Poisoned descriptions.

## 0.10.0
- Full arsenal: 85 items in six folders under Hunt Arsenal — Handguns (16), Long Guns (22), Grenades & Bombs (16), Thrown Weapons (5), Melee Weapons (8), Support Items (18). Existing items are sorted into the folders; Mosin-Nagant and Martini-Henry get their full names.
- Support items: First Aid Kit, Vitality / Regeneration / Antidote / Stamina shots, ammo boxes, spyglass, decoys, traps, beetles. A Use button applies the effect (Health boxes, Burned chunks, conditions, spare rounds), spends the charge and posts it; consumables leave the sheet. The First Aid Kit can be used on a targeted ally; Doctor doubles it. Any Extra can be made a support item (kit button).
- Rebalance: power per band, rounds, reliability and slots reviewed with a damage simulation (tools/balance.py); tables in the README. On update the GM is asked to rewrite the world's weapons to the new stats (characters keep their rounds and stress). Game Settings → Hunt arsenal can create missing items or rebalance everything later.
- Melee and thrown weapons (Fight / Throw). Thrown weapons are recovered with the Reload button when nothing is spare. Tools (melee, thrown, derringer, flare pistol, hand crossbow, kits, traps) and consumables (explosives, shots, ammo boxes) don't use weapon slots: 4 of each, counted on the loadout line.
- Weapons: "double barrel / multiple barrels" action (one extra shot), spare rounds when full (what an ammo box refills), tool flag and notes shown on the sheet. Multi-charge thrown items (Fusee) spend a charge instead of vanishing.

## 0.9.1
- Biography tab: Description and Biography side by side, so the Arsenal panel gets more room.
- The Extras panel is renamed Arsenal.

## 0.9.0
- Hunter Creator: name, archetype or Custom, skill pyramid with the archetype's Great and Good skills fixed, aspects, signature stunt, starting trait dealt from the deck into the player's hand. From the Actors directory (new hunter) or a hunter sheet banner (rebuild).

## 0.8.0
- Splash damage: detonating an explosive asks for the impact point on the map and catches every token within its blast radius, friend or foe, the thrower included. Outer half of the radius: −2 power. The blast circle is drawn on the map for a few seconds.
- Blast radius per explosive (metres, converted on feet scenes): Dynamite 5, Frag 6, Concertina 4, Fire Bomb 4, Hellfire 6, Sticky 4, Choke 5. Editable in the item settings; existing explosives get their radius on update.
- Sticky bombs detonate centred on the token they stuck to.

## 0.7.3
- Explosives and incendiary bombs are single use: the item is removed from the sheet once thrown.

## 0.7.2
- Hunt chat cards with rolls carry a hidden dice total, so Fate Core Official's chat hook no longer throws an error on them.

## 0.7.1
- Holstered weapons get an Equip button (fist) next to their settings, so it is clear why the attack buttons are hidden.
- Weapon tools on the sheet no longer disappear if the loadout check hits an error; errors go to the console.

## 0.7.0
- Loadout: only equipped (toggled-on) weapons can fire; holstered weapons hide their buttons.
- Slots as in Hunt: Small 1, Medium 2, Large 3; budget 4, or 5 with Quartermaster (trait card or stunt); two weapons at most. Equipping beyond is refused; weapons that don't fit arrive holstered.
- Loadout line at the top of the Extras panel.

## 0.6.1
- Shotguns fire in a cone: the Romero 77 is a cone weapon (existing copies are updated).
- Explosives no longer show a shape setting: they always blast their zone.

## 0.6.0
- Explosives as items: Throw vs zone distance, scatter die, sticky bombs, Detonate button on the current targets, one Apply per victim, zone aspects.
- Seven explosives in the Hunt Arsenal folder, including the Fire Bomb and the Hellfire Bomb.
- Fire: fire hits and Burning kill ordinary monsters outright; bosses, fireproof monsters and those immune to Burning are spared. New "Fireproof" monster option (Meathead).
- Attack shapes: Single, Area, Cone, for weapons and monster attacks. The Butcher's Fire Breath is now a cone attack.
- On update, offers to replace the Meathead and the Butcher.

## 0.5.1
- Bosses rebalanced: Fight 3 (was 4), main attack power 2 and secondary 1 (was 4 and 3). Average damage per hit drops from 7.5 to 5.
- On update, offers to replace the five bosses with the new stats.
- Hunt bestiary menu: create missing monsters, or rebuild the whole bestiary.

## 0.5.0
- Monsters: monster data on actors (category, dread, armour, vital hit kills, immunities, boss phases), natural attacks (no ammo, no jams), sheet banner with phase selector.
- Phase bonuses on attack and defence rolls; armour, instant kills and immunities when applying damage; dead status on killed monsters.
- Dread: a monster's hit on a hunter rolls Will against its dread, marks Dread and then Shaken.
- Starter bestiary of 12 Stillwater monsters (Hunt Bestiary folder).
- Monster Creator (Actors directory button and settings menu).
- Weapons: "Conditions on hit" field.

## 0.4.0
- Apply button on attack cards: the defender chooses consequences (and names them), the rest marks Health boxes from the last unburned chunk, conditions are ticked, Bleeding escalates to Heavy Bleeding, overflow marks Downed, summary in chat.

## 0.3.0
- Traits as cards: 45 traits (rewritten for the Fate rules) in three decks by tier, illustrated card faces and tier backs.
- One trait hand per player, 4 cards at most; Played Traits pile posts the trait to chat and spends a Fate point for active traits, the card stays in hand; Discarded Traits pile.
- Settings menu to create missing decks, piles and hands.

## 0.2.0
- Weapons: weapon data on Extras, attack button with full resolution (4dF + skill, opposition with range, cover and the target's Athletics, ballistic die, extra shots, ammo, weapon stress and jams), reload, clear jam, weapon settings dialog.
- Seven sample weapons created in a Hunt Arsenal folder (on install, on update, or from the settings menu).
- Chat cards in the Hunt theme.
- Updating the module no longer asks to reinstall the rules.

## 0.1.0
- First version: Hunt rules installer for Fate Core Official (skills, tracks, conditions, aspects, archetype stunts) and dark theme.

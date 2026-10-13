/* Hunt: Showdown RPG — loadout.
 * A hunter's weapons are equipped with Fate Core Official's active toggle on the Extra.
 * Slots, as in Hunt: Small 1, Medium 2, Large 3. Budget 4 (5 with Quartermaster), two weapons at most.
 * Only equipped weapons can fire. Explosives and monster attacks don't use slots.
 */

import { MODULE_ID, getWeapon, monsterData } from "./weapons.js";

export const SLOT_SIZE = { Small: 1, Medium: 2, Large: 3 };
const MAX_WEAPONS = 2;

/* Weapons that take a slot: firearms, bows, melee weapons. Not explosives, not natural attacks. */
export function usesSlot(item) {
    const w = getWeapon(item);
    return !!w && !w.explosive && w.action !== "natural";
}

export function isEquipped(item) {
    return item?.system?.active !== false;
}

function hasQuartermaster(actor) {
    if (Object.values(actor.system?.stunts ?? {}).some(s => s.name === "Quartermaster")) return true;
    // Trait cards: the hand of any player who owns this hunter.
    const owners = game.users.filter(u => !u.isGM && actor.testUserPermission(u, "OWNER")).map(u => u.id);
    return game.cards.some(c => c.getFlag(MODULE_ID, "role") === "hand"
        && owners.includes(c.getFlag(MODULE_ID, "user"))
        && c.cards.some(card => card.name === "Quartermaster"));
}

export function slotBudget(actor) {
    return hasQuartermaster(actor) ? 5 : 4;
}

function equippedWeapons(actor, exceptId = null) {
    return actor.items.filter(i => i.id !== exceptId && usesSlot(i) && isEquipped(i));
}

/* Returns null if the item can be equipped alongside what is already equipped, otherwise the reason. */
export function cannotEquip(actor, item) {
    if (!actor || monsterData(actor) || !usesSlot(item)) return null;
    const others = equippedWeapons(actor, item.id);
    if (others.length >= MAX_WEAPONS) return `${actor.name} already carries two weapons (${others.map(i => i.name).join(", ")}). Holster one first.`;
    const used = others.reduce((n, i) => n + (SLOT_SIZE[getWeapon(i).slot] ?? 3), 0);
    const size = SLOT_SIZE[getWeapon(item).slot] ?? 3;
    const budget = slotBudget(actor);
    if (used + size > budget) {
        return `${item.name} (${getWeapon(item).slot}) doesn't fit: ${used}/${budget} slots used by ${others.map(i => `${i.name} (${getWeapon(i).slot})`).join(", ")}.${budget < 5 ? " Quartermaster raises the budget to 5." : ""}`;
    }
    return null;
}

export function loadoutSummary(actor) {
    if (monsterData(actor)) return "";
    const eq = equippedWeapons(actor);
    const used = eq.reduce((n, i) => n + (SLOT_SIZE[getWeapon(i).slot] ?? 3), 0);
    return `Loadout ${used}/${slotBudget(actor)} slots · ${eq.length}/${MAX_WEAPONS} weapons${eq.length ? `: ${eq.map(i => i.name).join(", ")}` : ""}`;
}

export function registerLoadoutHooks() {
    // Equipping (toggle on) a weapon that doesn't fit is refused.
    Hooks.on("preUpdateItem", (item, changes) => {
        const turningOn = foundry.utils.getProperty(changes, "system.active") === true;
        if (!turningOn || !item.parent || !usesSlot(item)) return;
        const reason = cannotEquip(item.parent, item);
        if (reason) { ui.notifications.warn(reason); return false; }
    });
    // A weapon dropped on a hunter arrives holstered if it doesn't fit.
    Hooks.on("preCreateItem", (item, data, options, userId) => {
        if (userId !== game.user.id || !item.parent || !usesSlot(item) || !isEquipped(item)) return;
        const reason = cannotEquip(item.parent, item);
        if (reason) {
            item.updateSource({ "system.active": false });
            ui.notifications.info(`${item.name} added holstered. ${reason}`);
        }
    });
}

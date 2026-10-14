/* Hunt: Showdown RPG for Fate Core Official
 * Installs the Hunt rules (skills, tracks, aspects, archetype stunts, dark theme)
 * into the world through Fate Core Official's own settings importer.
 */

import { decorateSheet } from "./weapons.js";
import { createTraitDecks, createHands, registerTraitHooks } from "./traits.js";
import { registerDamageHooks } from "./damage.js";
import { registerExplosiveHooks } from "./explosives.js";
import { registerLoadoutHooks } from "./loadout.js";
import { openHunterCreator, decorateHunterSheet } from "./creator.js";
import { sideBySideBio } from "./layout.js";
import { createBestiary, rebuildBestiary, openCreator, decorateMonsterSheet } from "./monsters.js";
import "./support.js";

const MODULE_ID = "hunt-showdown-fco";
const SYSTEM_ID = "fate-core-official";
const SETUP_PATH = `modules/${MODULE_ID}/data/setup.json`;
const ARSENAL_PATH = `modules/${MODULE_ID}/data/arsenal.json`;
const ARSENAL_FOLDER = "Hunt Arsenal";
const CATEGORIES = {
    handgun: { label: "Handguns", color: "#5c4127" },
    longgun: { label: "Long Guns", color: "#4f3a22" },
    grenade: { label: "Grenades & Bombs", color: "#6b2f1e" },
    thrown: { label: "Thrown Weapons", color: "#5a4a2a" },
    melee: { label: "Melee Weapons", color: "#4a4a3a" },
    support: { label: "Support Items", color: "#2f4a3a" }
};
// Items renamed since earlier versions (old name → new name).
const RENAMED = { "Mosin-Nagant": "Mosin-Nagant M1891", "Martini-Henry": "Martini-Henry IC1" };

async function loadArsenal() {
    return (await fetch(ARSENAL_PATH)).json();
}

function arsenalDoc(entry, folderId) {
    const flags = {};
    if (entry.weapon) flags.weapon = entry.weapon;
    if (entry.support) flags.support = entry.support;
    return {
        name: entry.name, type: "Extra", img: entry.img, folder: folderId,
        system: { description: { value: entry.description } },
        flags: { [MODULE_ID]: flags }
    };
}

/* The Hunt Arsenal folder and its category sub-folders, created when missing. */
async function arsenalFolders() {
    let root = game.folders.find(f => f.type === "Item" && f.name === ARSENAL_FOLDER && !f.folder);
    if (!root) root = await Folder.create({ name: ARSENAL_FOLDER, type: "Item", color: "#5c4127" });
    const folders = { root };
    for (const [key, cat] of Object.entries(CATEGORIES)) {
        let f = game.folders.find(f => f.type === "Item" && f.name === cat.label && f.folder?.id === root.id);
        if (!f) f = await Folder.create({ name: cat.label, type: "Item", color: cat.color, folder: root.id });
        folders[key] = f;
    }
    return folders;
}

function inArsenal(item, folders) {
    const ids = new Set(Object.values(folders).map(f => f.id));
    return !!item.folder && ids.has(item.folder.id);
}

/* Creates the arsenal as world Extras, sorted into category folders, skipping names already there. */
async function createArsenal() {
    if (!game.user.isGM) return 0;
    const entries = await loadArsenal();
    const folders = await arsenalFolders();
    // Earlier versions put everything in the root folder: sort those into their categories and apply renames.
    for (const item of game.items.filter(i => inArsenal(i, folders))) {
        const newName = RENAMED[item.name];
        const entry = entries.find(e => e.name === (newName ?? item.name));
        if (!entry) continue;
        const update = {};
        if (newName) update.name = newName;
        if (item.folder.id !== folders[entry.category].id) update.folder = folders[entry.category].id;
        if (Object.keys(update).length) await item.update(update);
    }
    const existing = new Set(game.items.filter(i => inArsenal(i, folders)).map(i => i.name));
    const docs = entries.filter(e => !existing.has(e.name)).map(e => arsenalDoc(e, folders[e.category].id));
    if (docs.length) await Item.createDocuments(docs);
    return docs.length;
}

/* Rebalance: rewrites the stats of every arsenal item in the world and on characters from the module's data.
 * World copies are replaced outright; copies on characters keep their loaded rounds, spare rounds, stress and charges. */
async function rebalanceArsenal() {
    if (!game.user.isGM) return 0;
    const entries = await loadArsenal();
    const byName = Object.fromEntries(entries.map(e => [e.name, e]));
    const folders = await arsenalFolders();
    let n = 0;
    const all = [...game.items, ...game.actors.contents.flatMap(a => [...a.items])];
    for (const item of all) {
        const name = RENAMED[item.name] ?? item.name;
        const entry = byName[name];
        if (!entry || !(item.getFlag(MODULE_ID, "weapon") || item.getFlag(MODULE_ID, "support"))) continue;
        const update = { name, img: entry.img, "system.description.value": entry.description };
        const old = item.getFlag(MODULE_ID, "weapon") ?? {};
        const keepState = !!item.parent;
        if (entry.weapon) {
            const w = foundry.utils.deepClone(entry.weapon);
            if (keepState) {
                w.loaded = Math.min(Number(old.loaded ?? w.loaded), w.capacity);
                w.reserve = Math.min(Number(old.reserve ?? w.reserve), w.maxReserve ?? w.reserve);
                w.stress = Number(old.stress ?? 0);
                if (old.ammo) w.ammo = old.ammo;
            }
            update[`flags.${MODULE_ID}.weapon`] = w;
            update[`flags.${MODULE_ID}.-=support`] = null;
        }
        if (entry.support) {
            const sp = foundry.utils.deepClone(entry.support);
            const oldS = item.getFlag(MODULE_ID, "support");
            if (keepState && oldS) sp.uses = Math.min(Number(oldS.uses ?? sp.uses), sp.usesMax);
            update[`flags.${MODULE_ID}.support`] = sp;
            update[`flags.${MODULE_ID}.-=weapon`] = null;
        }
        if (!item.parent && inArsenal(item, folders)) update.folder = folders[entry.category].id;
        await item.update(update);
        n++;
    }
    return n;
}

class TraitsMenu extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = { id: "hunt-traits", window: { title: "HUNT.Traits.MenuName" } };
    async render() {
        const n = (await createTraitDecks()) + (await createHands());
        ui.notifications.info(game.i18n.format("HUNT.Traits.Done", { n }));
        return this;
    }
}

class BestiaryMenu extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = { id: "hunt-bestiary", window: { title: "HUNT.Bestiary.MenuName" } };
    async render() {
        const mode = await foundry.applications.api.DialogV2.wait({
            window: { title: game.i18n.localize("HUNT.Bestiary.MenuName") },
            content: `<p>${game.i18n.localize("HUNT.Bestiary.Choice")}</p>`,
            buttons: [
                { action: "missing", label: game.i18n.localize("HUNT.Bestiary.Missing"), default: true },
                { action: "rebuild", label: game.i18n.localize("HUNT.Bestiary.Rebuild") }
            ],
            rejectClose: false
        });
        if (!mode) return this;
        try {
            const n = mode === "rebuild" ? await rebuildBestiary() : await createBestiary();
            ui.notifications.info(game.i18n.format("HUNT.Bestiary.Done", { n }));
        } catch (e) { ui.notifications.error(e.message); }
        return this;
    }
}

class CreatorMenu extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = { id: "hunt-creator-menu", window: { title: "HUNT.Creator.MenuName" } };
    async render() { openCreator(); return this; }
}

class ArsenalMenu extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = { id: "hunt-arsenal", window: { title: "HUNT.Arsenal.MenuName" } };
    async render() {
        const mode = await foundry.applications.api.DialogV2.wait({
            window: { title: game.i18n.localize("HUNT.Arsenal.MenuName") },
            content: `<p>${game.i18n.localize("HUNT.Arsenal.Choice")}</p>`,
            buttons: [
                { action: "missing", label: game.i18n.localize("HUNT.Arsenal.Missing"), default: true },
                { action: "rebalance", label: game.i18n.localize("HUNT.Arsenal.Rebalance") }
            ],
            rejectClose: false
        });
        if (!mode) return this;
        try {
            const n = mode === "rebalance" ? await rebalanceArsenal() : await createArsenal();
            ui.notifications.info(game.i18n.format(mode === "rebalance" ? "HUNT.Arsenal.Rebalanced" : "HUNT.Arsenal.Done", { n }));
        } catch (e) { ui.notifications.error(e.message); console.error(e); }
        return this;
    }
}

class HuntInstaller extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = { id: "hunt-installer", window: { title: "HUNT.Install.Title" } };

    // Opening the settings menu runs the installer directly instead of showing a window.
    async render() {
        await HuntInstaller.run({ manual: true });
        return this;
    }

    static async run({ manual = false } = {}) {
        if (!game.user.isGM) return;
        if (typeof fcoConstants === "undefined" || !fcoConstants.wd()) {
            ui.notifications.error(game.i18n.localize("HUNT.Install.NoSystem"));
            return;
        }

        const confirmed = await foundry.applications.api.DialogV2.confirm({
            window: { title: game.i18n.localize("HUNT.Install.Title") },
            content: `<p>${game.i18n.localize("HUNT.Install.Body")}</p><p><strong>${game.i18n.localize("HUNT.Install.Warning")}</strong></p>`,
            modal: true,
            rejectClose: false
        });
        if (!confirmed) {
            if (!manual) await game.settings.set(MODULE_ID, "installedVersion", game.modules.get(MODULE_ID).version);
            return;
        }

        const hunt = await (await fetch(SETUP_PATH)).json();

        // Start from the world's current settings so every key the importer reads is defined,
        // then overlay the Hunt settings.
        const settings = JSON.parse(fcoConstants.exportSettings());
        Object.assign(settings, hunt);
        // The importer reads "PlayerThings" while the exporter writes "playerThings".
        settings.PlayerThings = game.settings.get(SYSTEM_ID, "PlayerThings");
        // The importer misreads this key; leave the world's value untouched.
        delete settings["fu-roll-formulae"];

        await createArsenal();
        await createTraitDecks();
        await createHands();

        // A personal colour scheme on the GM would hide the Hunt theme.
        await game.user.unsetFlag(SYSTEM_ID, "current-sheet-scheme");
        await game.settings.set(MODULE_ID, "installedVersion", game.modules.get(MODULE_ID).version);

        ui.notifications.info(game.i18n.localize("HUNT.Install.Done"));
        // importSettings reloads the page when it finishes.
        await fcoConstants.importSettings(settings);
    }
}

Hooks.once("init", () => {
    game.settings.register(MODULE_ID, "installedVersion", {
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    game.settings.registerMenu(MODULE_ID, "install", {
        name: "HUNT.Install.MenuName",
        label: "HUNT.Install.MenuLabel",
        hint: "HUNT.Install.MenuHint",
        icon: "fas fa-skull",
        type: HuntInstaller,
        restricted: true
    });

    game.settings.registerMenu(MODULE_ID, "traits", {
        name: "HUNT.Traits.MenuName",
        label: "HUNT.Traits.MenuLabel",
        hint: "HUNT.Traits.MenuHint",
        icon: "fas fa-layer-group",
        type: TraitsMenu,
        restricted: true
    });

    game.settings.registerMenu(MODULE_ID, "creator", {
        name: "HUNT.Creator.MenuName",
        label: "HUNT.Creator.MenuLabel",
        hint: "HUNT.Creator.MenuHint",
        icon: "fas fa-skull",
        type: CreatorMenu,
        restricted: true
    });

    game.settings.registerMenu(MODULE_ID, "bestiary", {
        name: "HUNT.Bestiary.MenuName",
        label: "HUNT.Bestiary.MenuLabel",
        hint: "HUNT.Bestiary.MenuHint",
        icon: "fas fa-dragon",
        type: BestiaryMenu,
        restricted: true
    });

    game.settings.registerMenu(MODULE_ID, "arsenal", {
        name: "HUNT.Arsenal.MenuName",
        label: "HUNT.Arsenal.MenuLabel",
        hint: "HUNT.Arsenal.MenuHint",
        icon: "fas fa-gun",
        type: ArsenalMenu,
        restricted: true
    });
});

registerTraitHooks();
registerDamageHooks();
registerExplosiveHooks();
registerLoadoutHooks();

// Fate Core Official decorates every 4dF roll message and expects a ".dice-total" element.
// Hunt cards don't have one, so give them a hidden one to keep FCO's chat hook from failing.
Hooks.on("preCreateChatMessage", (message, data) => {
    const content = message.content ?? "";
    if (!content.includes("hunt-card") || content.includes("dice-total")) return;
    if (!(message.rolls?.length || data.rolls?.length)) return;
    message.updateSource({ content: `${content}<span class="dice-total" hidden></span>` });
});

// Weapon tools and the monster banner on Fate Core Official character sheets.
Hooks.on("renderfcoCharacter", decorateSheet);
Hooks.on("renderfcoCharacter", decorateMonsterSheet);
Hooks.on("renderfcoCharacter", sideBySideBio);
Hooks.on("renderfcoCharacter", (app, html) => {
    try { decorateHunterSheet(app, html); } catch (e) { console.error("Hunt: hunter banner", e); }
});

// Hunter Creator button in the Actors directory (everyone).
Hooks.on("renderActorDirectory", (app, html) => {
    const root = html instanceof HTMLElement ? html : html[0];
    const actions = root.querySelector(".header-actions");
    if (!actions || actions.querySelector(".hunt-hcreator-btn")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hunt-creator-btn hunt-hcreator-btn";
    btn.innerHTML = `<i class="fas fa-user-plus"></i> ${game.i18n.localize("HUNT.Hunter.Button")}`;
    btn.addEventListener("click", () => openHunterCreator());
    actions.append(btn);
});

// Monster Creator button in the Actors directory (GM only).
Hooks.on("renderActorDirectory", (app, html) => {
    if (!game.user.isGM) return;
    const root = html instanceof HTMLElement ? html : html[0];
    const actions = root.querySelector(".header-actions");
    if (!actions || actions.querySelector(".hunt-creator-btn")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hunt-creator-btn";
    btn.innerHTML = `<i class="fas fa-skull"></i> ${game.i18n.localize("HUNT.Creator.MenuName")}`;
    btn.addEventListener("click", () => openCreator());
    actions.append(btn);
});

Hooks.once("ready", async () => {
    if (!game.user.isGM) return;
    const installed = game.settings.get(MODULE_ID, "installedVersion");
    const version = game.modules.get(MODULE_ID).version;
    if (!installed) return HuntInstaller.run();
    if (installed !== version) {
        // Module update: add any new sample weapons, but never overwrite the world's rules unasked.
        const n = await createArsenal();
        if (n) ui.notifications.info(game.i18n.format("HUNT.Arsenal.Done", { n }));
        const d = await createTraitDecks();
        if (d) ui.notifications.info(game.i18n.format("HUNT.Traits.Done", { n: d }));
        // 0.10.0: full arsenal, rebalanced stats, category folders.
        if (foundry.utils.isNewerVersion("0.10.0", installed)) {
            const ok = await foundry.applications.api.DialogV2.confirm({
                window: { title: game.i18n.localize("HUNT.Arsenal.MenuName") },
                content: `<p>${game.i18n.localize("HUNT.Arsenal.UpdateBalance")}</p>`,
                rejectClose: false
            });
            if (ok) {
                try {
                    const r = await rebalanceArsenal();
                    ui.notifications.info(game.i18n.format("HUNT.Arsenal.Rebalanced", { n: r }));
                } catch (e) { console.warn("Hunt arsenal:", e); }
            }
        }
        // 0.5.1: bosses rebalanced (Fight 3, lower attack power).
        if (foundry.utils.isNewerVersion("0.5.1", installed)) {
            const ok = await foundry.applications.api.DialogV2.confirm({
                window: { title: game.i18n.localize("HUNT.Bestiary.MenuName") },
                content: `<p>${game.i18n.localize("HUNT.Bestiary.Rebalance")}</p>`,
                rejectClose: false
            });
            if (ok) {
                try {
                    await rebuildBestiary(["The Butcher", "The Spider", "The Assassin", "Scrapbeak", "Rotjaw"]);
                } catch (e) { console.warn("Hunt bestiary:", e); }
            }
        }
        // 0.8.0: explosives get a blast radius.
        if (foundry.utils.isNewerVersion("0.8.0", installed)) {
            const { DEFAULT_RADII } = await import("./explosives.js");
            const all = [...game.items, ...game.actors.contents.flatMap(a => [...a.items])];
            for (const item of all) {
                const ex = item.getFlag(MODULE_ID, "weapon")?.explosive;
                if (ex && !(Number(ex.radius) > 0)) await item.setFlag(MODULE_ID, "weapon.explosive.radius", DEFAULT_RADII[item.name] ?? 5);
            }
        }
        // 0.6.1: shotguns fire in a cone. Updates the Romero 77 in the world and on characters.
        if (foundry.utils.isNewerVersion("0.6.1", installed)) {
            const all = [...game.items, ...game.actors.contents.flatMap(a => [...a.items])];
            for (const item of all) {
                if (item.name === "Romero 77" && item.getFlag(MODULE_ID, "weapon") && (item.getFlag(MODULE_ID, "weapon").shape ?? "single") === "single") {
                    await item.setFlag(MODULE_ID, "weapon.shape", "cone");
                }
            }
        }
        // 0.6.0: Meathead becomes fireproof, the Butcher's Fire Breath becomes a cone attack.
        if (foundry.utils.isNewerVersion("0.6.0", installed)) {
            const ok = await foundry.applications.api.DialogV2.confirm({
                window: { title: game.i18n.localize("HUNT.Bestiary.MenuName") },
                content: `<p>${game.i18n.localize("HUNT.Bestiary.Fire")}</p>`,
                rejectClose: false
            });
            if (ok) {
                try { await rebuildBestiary(["Meathead", "The Butcher"]); } catch (e) { console.warn("Hunt bestiary:", e); }
            }
        }
        try {
            const b = await createBestiary();
            if (b) ui.notifications.info(game.i18n.format("HUNT.Bestiary.Done", { n: b }));
        } catch (e) { console.warn("Hunt bestiary:", e); }
        await game.settings.set(MODULE_ID, "installedVersion", version);
    }
    // Players added since the last load get their trait hand.
    await createHands();
    // First load after a fresh install: the bestiary needs the installed tracks, so it is created now.
    if (!game.folders.find(f => f.type === "Actor" && f.name === "Hunt Bestiary")) {
        try { await createBestiary(); } catch (e) { console.warn("Hunt bestiary:", e); }
    }
});

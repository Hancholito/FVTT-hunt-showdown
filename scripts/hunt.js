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
import { createBestiary, rebuildBestiary, openCreator, decorateMonsterSheet } from "./monsters.js";

const MODULE_ID = "hunt-showdown-fco";
const SYSTEM_ID = "fate-core-official";
const SETUP_PATH = `modules/${MODULE_ID}/data/setup.json`;
const WEAPONS_PATH = `modules/${MODULE_ID}/data/weapons.json`;
const ARSENAL_FOLDER = "Hunt Arsenal";

/* Creates the sample weapons as world Extras in a "Hunt Arsenal" folder, skipping names already there. */
async function createArsenal() {
    if (!game.user.isGM) return 0;
    const weapons = await (await fetch(WEAPONS_PATH)).json();
    let folder = game.folders.find(f => f.type === "Item" && f.name === ARSENAL_FOLDER);
    if (!folder) folder = await Folder.create({ name: ARSENAL_FOLDER, type: "Item", color: "#5c4127" });
    const existing = new Set(game.items.filter(i => i.folder?.id === folder.id).map(i => i.name));
    const docs = weapons.filter(w => !existing.has(w.name)).map(w => ({
        name: w.name,
        type: "Extra",
        img: w.img,
        folder: folder.id,
        system: { description: { value: w.description } },
        flags: { [MODULE_ID]: { weapon: w.weapon } }
    }));
    if (docs.length) await Item.createDocuments(docs);
    return docs.length;
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
        const n = await createArsenal();
        ui.notifications.info(game.i18n.format("HUNT.Arsenal.Done", { n }));
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

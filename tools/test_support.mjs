// Headless test of support.js and loadout.js with Foundry stubs (node tools/test_support.mjs).
import assert from "node:assert/strict";

const MODULE_ID = "hunt-showdown-fco";
const messages = [];
globalThis.foundry = {
    utils: {
        mergeObject: (a, b) => structuredClone({ ...a, ...b }),
        deepClone: o => structuredClone(o),
        escapeHTML: s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
        getProperty: (o, p) => p.split(".").reduce((x, k) => x?.[k], o),
        isNewerVersion: () => false
    },
    applications: { api: { DialogV2: { wait: async () => "target", prompt: async () => null, confirm: async () => true } } }
};
globalThis.ChatMessage = { create: async m => messages.push(m), getSpeaker: () => ({}) };
globalThis.ui = { notifications: { warn: m => messages.push({ warn: m }), info: () => {}, error: () => {} } };
globalThis.Hooks = { on: () => {}, once: () => {} };
globalThis.game = { user: { id: "u1", targets: Object.assign(new Set(), { first() { return undefined; } }), isGM: true }, users: [], cards: [], items: [], actors: { contents: [] }, settings: { get: () => ({}) }, i18n: { localize: s => s, format: s => s } };

function track(name, boxes, marked = []) {
    return { name, box_values: Array.from({ length: boxes }, (_, i) => marked.includes(i)) };
}
function makeActor(id, tracks) {
    const actor = {
        id, name: id, items: [], isOwner: true, system: { tracks, skills: {}, stunts: {} },
        testUserPermission: () => true,
        getFlag: () => null,
        async update(u) { for (const [k, v] of Object.entries(u)) { const p = k.split("."); let o = this; for (const s of p.slice(0, -1)) o = o[s]; o[p.at(-1)] = v; } }
    };
    actor.items.filter = Array.prototype.filter.bind(actor.items);
    return actor;
}
function makeItem(name, flags, parent) {
    const item = {
        name, img: "", parent, flags: { [MODULE_ID]: flags }, system: { active: true },
        getFlag: (m, k) => item.flags[m]?.[k] ?? null,
        async update(u) { for (const [k, v] of Object.entries(u)) { const p = k.split("."); let o = item; for (const s of p.slice(0, -1)) o = o[s]; o[p.at(-1)] = v; } },
        async delete() { item.deleted = true; parent.items.splice(parent.items.indexOf(item), 1); }
    };
    return item;
}

const { useSupport, getSupport, supportSummary } = await import("../scripts/support.js");
const { itemKind, usesSlot, loadoutSummary } = await import("../scripts/loadout.js");
const arsenal = (await import("node:fs")).readFileSync(new URL("../data/arsenal.json", import.meta.url), "utf8");
const data = JSON.parse(arsenal);
const entry = n => data.find(e => e.name === n);

// --- First Aid Kit: 2 boxes, stops bleeding, charge spent, item stays.
const hunter = makeActor("Hunter", {
    t1: track("Health", 6, [0, 1, 2, 3]), t2: track("Burned", 3, [0]), t3: track("Bleeding", 1, [0]), t4: track("Heavy Bleeding", 1), t5: track("Poisoned", 1, [0])
});
const kit = makeItem("First Aid Kit", { support: entry("First Aid Kit").support }, hunter);
hunter.items.push(kit);
await useSupport(hunter, kit);
assert.deepEqual(hunter.system.tracks.t1.box_values, [false, false, true, true, false, false], "2 boxes cleared from the first chunk");
assert.equal(hunter.system.tracks.t3.box_values[0], false, "Bleeding cured");
assert.equal(getSupport(kit).uses, 2, "one charge spent");
assert.equal(kit.deleted, undefined, "kit stays");

// --- Regeneration Shot: restores a burned chunk and clears a box, item gone.
const regen = makeItem("Regeneration Shot", { support: entry("Regeneration Shot").support }, hunter);
hunter.items.push(regen);
await useSupport(hunter, regen);
assert.deepEqual(hunter.system.tracks.t2.box_values, [false, false, false], "burned chunk restored");
assert.deepEqual(hunter.system.tracks.t1.box_values, [false, false, false, true, false, false], "1 more box cleared");
assert.equal(regen.deleted, true, "consumable removed");

// --- Antidote cures Poisoned.
const anti = makeItem("Weak Antidote Shot", { support: entry("Weak Antidote Shot").support }, hunter);
hunter.items.push(anti);
await useSupport(hunter, anti);
assert.equal(hunter.system.tracks.t5.box_values[0], false, "Poisoned cured");

// --- Ammo Box refills firearms, not thrown knives.
const nagant = makeItem("Nagant M1895", { weapon: { ...entry("Nagant M1895").weapon, reserve: 3 } }, hunter);
const knives = makeItem("Throwing Knives", { weapon: { ...entry("Throwing Knives").weapon } }, hunter);
const box = makeItem("Ammo Box", { support: entry("Ammo Box").support }, hunter);
hunter.items.push(nagant, knives, box);
await useSupport(hunter, box);
assert.equal(nagant.flags[MODULE_ID].weapon.reserve, 14, "spare rounds refilled to max");
assert.equal(box.deleted, true);

// --- Loadout kinds.
assert.equal(itemKind(nagant), "weapon");
assert.equal(itemKind(knives), "tool");
assert.equal(itemKind(kit), "tool");
assert.equal(usesSlot(knives), false, "thrown weapons use no weapon slot");
const derringer = makeItem("Quad Derringer", { weapon: entry("Quad Derringer").weapon }, hunter);
assert.equal(usesSlot(derringer), false, "tool firearm uses no weapon slot");
assert.equal(itemKind(makeItem("Fusee", { weapon: entry("Fusee").weapon }, hunter)), "tool", "3-charge fusee is a tool");
assert.equal(itemKind(makeItem("Frag Bomb", { weapon: entry("Frag Bomb").weapon }, hunter)), "consumable");
const summary = loadoutSummary(hunter);
assert.match(summary, /Tools 2\/4/, summary);
assert.match(summary, /1\/2 weapons: Nagant M1895/, summary);

// --- Every arsenal entry is well formed.
for (const e of data) {
    assert.ok(["handgun", "longgun", "grenade", "thrown", "melee", "support"].includes(e.category), e.name);
    if (e.weapon) {
        assert.ok(e.weapon.power[e.weapon.best] !== null, `${e.name}: best band has a power`);
        assert.ok(["single", "bolt", "lever", "pump", "double", "sa_revolver", "da_revolver", "semi", "melee", "thrown"].includes(e.weapon.action), e.name);
    }
    if (e.support) assert.ok(supportSummary(e.support).length > 0);
}
console.log("support/loadout tests passed —", messages.filter(m => m.content).length, "chat cards,", messages.filter(m => m.warn).length, "warnings");

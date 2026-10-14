// Headless test of resolveMulti: harmless blasts and dead monsters (node tools/test_blast.mjs).
import assert from "node:assert/strict";
const MODULE_ID = "hunt-showdown-fco";
const cards = [];
globalThis.foundry = { utils: { escapeHTML: s => String(s), mergeObject: (a, b) => ({ ...a, ...b }), deepClone: o => structuredClone(o) } };
globalThis.game = { settings: { get: () => ({}) }, user: { isGM: true } };
globalThis.Hooks = { on: () => {}, once: () => {} };
globalThis.Roll = class { constructor(f) { this.n = Number(f[0]); } async evaluate() { this.dice = [{ results: Array.from({ length: this.n }, () => ({ result: 0 })), options: {} }]; this.total = 0; this.result = "0"; return this; } };
globalThis.ChatMessage = { create: async m => cards.push(m), getSpeaker: () => ({}) };
const track = (name, n, marked = []) => ({ name, box_values: Array.from({ length: n }, (_, i) => marked.includes(i)) });
const token = (name, flags = {}, tracks = {}) => {
    const actor = { name, system: { tracks: { d: track("Downed", 1), ...tracks }, skills: {} }, statuses: new Set(), effects: [],
        getFlag: (m, k) => flags[k] ?? null };
    return { name, actor, document: { uuid: `Scene.x.Token.${name}` } };
};
const { resolveMulti } = await import("../scripts/explosives.js");
const grunt = token("Grunt", { monster: { category: "grunt" } });
const deadGrunt = token("Dead Grunt", { monster: { category: "grunt" } }, { d: track("Downed", 1, [0]) });
const hunter = token("Hunter");
// Flash bomb: power 0, Blinded. Attack 4 vs Athletics 0 → caught, no damage.
await resolveMulti({ actor: null, targets: [grunt, deadGrunt, hunter], title: "Flash", img: "", attackValue: 4, power: 0, conditions: ["Blinded"] });
let res = cards.at(-1).flags[MODULE_ID].results;
assert.equal(res.length, 2, "dead monster skipped");
assert.ok(res.every(r => r.damage === 0 && r.conditions.includes("Blinded")), JSON.stringify(res));
assert.match(cards.at(-1).content, /no damage/);
// Frag: power 3 → damage = shifts 4 + 3.
await resolveMulti({ actor: null, targets: [grunt], title: "Frag", img: "", attackValue: 4, power: 3, conditions: ["Bleeding"] });
res = cards.at(-1).flags[MODULE_ID].results;
assert.equal(res[0].damage, 7);
// Chaos bomb: power 0, no conditions → nobody gets an Apply button.
await resolveMulti({ actor: null, targets: [grunt], title: "Chaos", img: "", attackValue: 4, power: 0, conditions: [] });
assert.equal(cards.at(-1).flags[MODULE_ID].results.length, 0);
console.log("blast tests passed");

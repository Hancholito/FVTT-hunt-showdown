// Headless test of fatepoints.js invokeFromMessage (node tools/test_fate.mjs).
import assert from "node:assert/strict";
const MODULE_ID = "hunt-showdown-fco";
const created = [];
let nextChoice = null, rollValue = 0;
globalThis.foundry = { utils: { escapeHTML: s => String(s), deepClone: o => structuredClone(o), mergeObject: (a, b) => ({ ...a, ...b }) },
    applications: { api: { DialogV2: { prompt: async () => nextChoice } } } };
globalThis.Roll = class { constructor(f) { this.n = Number(f[0]); } async evaluate() { this.dice = [{ results: Array.from({ length: this.n }, () => ({ result: rollValue >= 1 ? 1 : 0 })), options: {} }]; this.total = this.n === 4 ? rollValue : this.dice[0].results.reduce((s, r) => s + r.result, 0); this.result = ""; return this; } };
globalThis.ChatMessage = { create: async m => { const msg = { id: "m" + created.length, ...m, getFlag: (mod, k) => m.flags?.[mod]?.[k] }; created.push(msg); return msg; }, getSpeaker: () => ({}) };
globalThis.ui = { notifications: { warn: w => { throw new Error("warn: " + w); } } };
globalThis.Hooks = { on: () => {}, once: () => {} };
const attacker = { name: "Hunter", isOwner: true, uuid: "Actor.h", system: { details: { fatePoints: { current: 2, refresh: 3 } } },
    async update(u) { this.system.details.fatePoints.current = u["system.details.fatePoints.current"]; } };
const defender = { name: "Grunt", isOwner: true, system: { details: { fatePoints: { current: 0 } } } };
globalThis.fromUuid = async u => u === "Actor.h" ? attacker : { actor: defender };
globalThis.game = { messages: { find: f => created.find(f) }, settings: { get: () => ({}) }, user: { isGM: true } };
const { invokeFromMessage } = await import("../scripts/fatepoints.js");
const calc = { actorUuid: "Actor.h", itemName: "Nagant", img: "", skill: "Shoot", band: "Close", targetUuid: "Token.g", targetName: "Grunt",
    atkDice: -1, mods: 3, aware: true, defDice: 1, defMods: 1, defEntered: null, rangePenalty: 0, cover: 0, power: 2, extraPlus: 0,
    ammoCondition: null, weaponConditions: [], blunt: false, dread: 0, invokes: [] };
// Original: attack 2 vs opposition 2 → near miss.
const original = { id: "orig", getFlag: (m, k) => ({ calc })[k] };
nextChoice = { side: "attack", aspect: "Crack Shot", mode: "plus2", free: false };
await invokeFromMessage(original);
let card = created.at(-1);
assert.equal(attacker.system.details.fatePoints.current, 1, "1 FP spent");
assert.equal(card.flags[MODULE_ID].supersedes, "orig");
assert.ok(card.flags[MODULE_ID].result.damage >= 1, "now a hit: " + card.content);
assert.match(card.content, /spends a Fate point on <em>Crack Shot<\/em>: \+2 to attack/);
// Superseded card can't be invoked again.
await assert.rejects(invokeFromMessage(original), /already changed/);
// Free invoke on the new card: no FP spent, +2 again (attack 6 vs 2 → 4 shifts, with style).
nextChoice = { side: "attack", aspect: "Marked", mode: "plus2", free: true };
await invokeFromMessage(card);
card = created.at(-1);
assert.equal(attacker.system.details.fatePoints.current, 1, "free invoke costs nothing");
assert.match(card.content, /total <strong>6<\/strong>/);
// Reroll the attack (dice now +4).
rollValue = 4;
nextChoice = { side: "attack", aspect: "", mode: "reroll", free: false };
await invokeFromMessage(card);
card = created.at(-1);
assert.equal(attacker.system.details.fatePoints.current, 0);
assert.match(card.content, /total <strong>11<\/strong>/, "4 dice + 3 + two +2 invokes");
// No FP left → refused.
nextChoice = { side: "attack", aspect: "", mode: "plus2", free: false };
await assert.rejects(invokeFromMessage(card), /no Fate point/);
console.log("fate point tests passed");

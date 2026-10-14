// Headless test of exchange.js tickActor (node tools/test_exchange.mjs).
import assert from "node:assert/strict";
const MODULE_ID = "hunt-showdown-fco";
globalThis.foundry = { utils: { escapeHTML: s => String(s), mergeObject: (a, b) => ({ ...a, ...b }), deepClone: o => structuredClone(o) } };
globalThis.game = { users: [], cards: [], user: { isGM: true } };
globalThis.Hooks = { on: () => {}, once: () => {} };
globalThis.ui = { notifications: { warn: () => {} } };
const track = (name, n, marked = []) => ({ name, box_values: Array.from({ length: n }, (_, i) => marked.includes(i)) });
function actor(tracks, flags = {}) {
    const a = { name: "A", system: { tracks, stunts: {} }, flags: { [MODULE_ID]: flags }, statuses: new Set(),
        getFlag: (m, k) => a.flags[m]?.[k], testUserPermission: () => false,
        toggleStatusEffect: async (id) => a.statuses.add(id),
        async update(u) { for (const [k, v] of Object.entries(u)) { const p = k.split("."); let o = a; for (const s of p.slice(0, -1)) o = o[s] ??= {}; o[p.at(-1)] = v; } } };
    return a;
}
const { tickActor } = await import("../scripts/exchange.js");
const H = a => a.system.tracks.h.box_values.map(v => v ? 1 : 0).join("");

// Hunter: Bleeding + Poisoned = 2 boxes from the back.
let a = actor({ h: track("Health", 6), b: track("Bleeding", 1, [0]), p: track("Poisoned", 1, [0]), d: track("Downed", 1), bu: track("Burned", 3) });
let l = await tickActor(a); assert.equal(H(a), "000011", l.join()); 
// Heavy Bleeding 2 + Burning 1 on a hunter with 2 free boxes in the first chunk → chunk 2 empties via Burning? 
a = actor({ h: track("Health", 6, [2, 3, 4, 5]), hb: track("Heavy Bleeding", 1, [0]), bn: track("Burning", 1, [0]), d: track("Downed", 1), bu: track("Burned", 3) });
l = await tickActor(a); assert.equal(H(a), "111111", l.join()); assert.equal(a.system.tracks.d.box_values[0], true, "overflow → Downed"); 
// Burning alone on a fresh hunter: 1 box, no chunk burned yet; second tick empties the chunk → Burned 1.
a = actor({ h: track("Health", 6), bn: track("Burning", 1, [0]), d: track("Downed", 1), bu: track("Burned", 3) });
await tickActor(a); assert.equal(H(a), "000001");
l = await tickActor(a); assert.equal(H(a), "000011"); assert.deepEqual(a.system.tracks.bu.box_values, [true, false, false], l.join());
// Ordinary monster burning → dead.  Boss burning → 1 box.  Immolator (immune) → nothing.
a = actor({ h: track("Health", 4), bn: track("Burning", 1, [0]), d: track("Downed", 1) }, { monster: { category: "elite" } });
l = await tickActor(a); assert.ok(a.statuses.has("dead"), l.join());
a = actor({ h: track("Health", 10), bn: track("Burning", 1, [0]), d: track("Downed", 1) }, { monster: { category: "boss" } });
await tickActor(a); assert.equal(a.system.tracks.h.box_values.filter(Boolean).length, 1);
a = actor({ h: track("Health", 4), bn: track("Burning", 1, [0]), d: track("Downed", 1) }, { monster: { category: "elite", immune: ["Burning"] } });
assert.equal(await tickActor(a), null);
// Regeneration clears a box; blocked while Poisoned (and poison still hurts).
a = actor({ h: track("Health", 6, [0, 1]), d: track("Downed", 1), bu: track("Burned", 3), p: track("Poisoned", 1) }, { regen: 2 });
await tickActor(a); assert.equal(H(a), "010000"); assert.equal(a.flags[MODULE_ID].regen, 1);
// Downed hunters don't tick.
a = actor({ h: track("Health", 6), b: track("Bleeding", 1, [0]), d: track("Downed", 1, [0]) });
assert.equal(await tickActor(a), null);
console.log("exchange tests passed");
// Monster whose last box is marked by bleeding dies.
{
    const { tickActor } = await import("../scripts/exchange.js");
    const m = actor({ h: track("Health", 2, [0]), b: track("Bleeding", 1, [0]), d: track("Downed", 1) }, { monster: { category: "grunt" } });
    await tickActor(m); assert.ok(m.statuses.has("dead"), "bled out");
    console.log("monster bleed-out test passed");
}

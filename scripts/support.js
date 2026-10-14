/* Hunt: Showdown RPG — support items (first aid kits, shots, ammo boxes, traps, tools).
 * A support item is a Fate Core Official "Extra" carrying flags[hunt-showdown-fco].support:
 *   { kind: "tool" | "consumable", uses, usesMax, target: "self" | "ally",
 *     effect: { heal, unburn, cure: [], ammo, text } }
 * The sheet gets a Use button on each support item. Tools keep their charges (uses 0 = unlimited);
 * consumables leave the sheet once used. "ally" items can be used on a targeted token in the zone.
 */

import { MODULE_ID, getWeapon } from "./weapons.js";

const NO_AMMO = ["melee", "natural", "thrown"];

function esc(text) {
    return foundry.utils.escapeHTML(String(text ?? ""));
}

export function getSupport(item) {
    const s = item?.getFlag(MODULE_ID, "support");
    if (!s) return null;
    return foundry.utils.mergeObject({ kind: "consumable", uses: 1, usesMax: 1, target: "self", effect: {} }, s, { inplace: false });
}

function trackEntry(actor, name) {
    const entry = Object.entries(actor.system.tracks ?? {}).find(([, t]) => t.name === name);
    return entry ? { key: entry[0], track: entry[1] } : null;
}

function hasStunt(actor, name) {
    return Object.values(actor.system?.stunts ?? {}).some(s => s.name === name);
}

/* Trait cards in the hand of any player who owns this hunter. */
function hasTrait(actor, name) {
    if (hasStunt(actor, name)) return true;
    const owners = game.users.filter(u => !u.isGM && actor.testUserPermission(u, "OWNER")).map(u => u.id);
    return game.cards.some(c => c.getFlag(MODULE_ID, "role") === "hand"
        && owners.includes(c.getFlag(MODULE_ID, "user"))
        && c.cards.some(card => card.name === name));
}

/* Clears up to n marked Health boxes, lowest index first (the first chunk heals first), skipping burned chunks. */
function healBoxes(actor, n, update) {
    const health = trackEntry(actor, "Health");
    if (!health || n <= 0) return 0;
    const values = [...(health.track.box_values ?? [])];
    const burned = (trackEntry(actor, "Burned")?.track?.box_values ?? []).filter(v => v).length;
    const usable = Math.max(0, values.length - burned * 2);
    let cleared = 0;
    for (let i = 0; i < usable && cleared < n; i++) {
        if (values[i]) { values[i] = false; cleared++; }
    }
    if (cleared) update[`system.tracks.${health.key}.box_values`] = values;
    return cleared;
}

/* Restores up to n burned chunks (last burned first). */
function unburn(actor, n, update) {
    const burned = trackEntry(actor, "Burned");
    if (!burned || n <= 0) return 0;
    const values = [...(burned.track.box_values ?? [])];
    let restored = 0;
    for (let i = values.length - 1; i >= 0 && restored < n; i--) {
        if (values[i]) { values[i] = false; restored++; }
    }
    if (restored) update[`system.tracks.${burned.key}.box_values`] = values;
    return restored;
}

function cure(actor, names, update) {
    const cured = [];
    for (const name of names ?? []) {
        const t = trackEntry(actor, name);
        if (!t || !t.track.box_values?.some(v => v)) continue;
        update[`system.tracks.${t.key}.box_values`] = t.track.box_values.map(() => false);
        cured.push(name);
    }
    return cured;
}

/* Refills the spare rounds of every firearm the actor carries. */
async function refillAmmo(actor) {
    const refilled = [];
    for (const item of actor.items) {
        const w = getWeapon(item);
        if (!w || w.explosive || NO_AMMO.includes(w.action)) continue;
        const max = Number(w.maxReserve ?? w.reserve ?? 0);
        if (max <= 0 || w.reserve >= max) continue;
        await item.update({ [`flags.${MODULE_ID}.weapon.reserve`]: max });
        refilled.push(`${item.name} (${max})`);
    }
    return refilled;
}

/* ------------------------------------------------------------ use */

export async function useSupport(actor, item) {
    const s = getSupport(item);
    if (!s) return;
    if (s.usesMax > 0 && s.uses <= 0) return ui.notifications.warn(`${item.name} is used up.`);

    // Target: the hunter themself, or a targeted token for "ally" items.
    let target = actor;
    if (s.target === "ally") {
        const t = game.user.targets.first()?.actor;
        if (t && t.id !== actor.id) {
            const choice = await foundry.applications.api.DialogV2.wait({
                window: { title: `${item.name} — on whom?` },
                content: `<p>Use <strong>${esc(item.name)}</strong> on yourself or on <strong>${esc(t.name)}</strong> (targeted, must be in your zone)?</p>`,
                buttons: [
                    { action: "self", label: actor.name, default: true },
                    { action: "target", label: t.name }
                ],
                rejectClose: false
            });
            if (!choice) return;
            if (choice === "target") target = t;
        }
    }

    const e = s.effect ?? {};
    const update = {};
    const lines = [];

    let heal = Number(e.heal ?? 0);
    if (heal && item.name.includes("First Aid") && hasTrait(actor, "Doctor")) { heal *= 2; lines.push("Doctor: twice the boxes"); }
    const healed = healBoxes(target, heal, update);
    if (heal) lines.push(`${healed} Health box${healed === 1 ? "" : "es"} cleared`);
    const restored = unburn(target, Number(e.unburn ?? 0), update);
    if (restored) lines.push(`${restored} Burned chunk${restored === 1 ? "" : "s"} restored`);
    const cured = cure(target, e.cure, update);
    if (cured.length) lines.push(`cured: ${cured.join(", ")}`);

    if (Object.keys(update).length) await target.update(update);

    if (e.ammo) {
        const refilled = await refillAmmo(target);
        lines.push(refilled.length ? `spare rounds refilled: ${refilled.join(", ")}` : "no firearm needed rounds");
    }

    // Charges.
    if (s.usesMax > 0) {
        const left = s.uses - 1;
        if (left <= 0 && s.kind === "consumable" && item.parent) await item.delete();
        else await item.update({ [`flags.${MODULE_ID}.support.uses`]: Math.max(0, left) });
    }
    const charges = s.usesMax > 0 ? (s.kind === "consumable" && s.usesMax === 1 ? "single use" : `${Math.max(0, s.uses - 1)}/${s.usesMax} left`) : "";

    await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="hunt-card">
          <header class="hunt-card__head"><img src="${item.img}" alt=""><div><h3>${esc(item.name)}</h3>
            <span class="hunt-hint">${esc(actor.name)}${target.id !== actor.id ? ` → ${esc(target.name)}` : ""}${charges ? ` · ${charges}` : ""}</span></div></header>
          ${e.text ? `<div class="hunt-row">${esc(e.text)}</div>` : ""}
          ${lines.length ? `<div class="hunt-result">${lines.map(esc).join(" · ")}</div>` : ""}
        </div>`
    });
}

/* ------------------------------------------------------------ settings dialog */

export async function configureSupport(item) {
    const s = getSupport(item) ?? { kind: "consumable", uses: 1, usesMax: 1, target: "self", effect: {} };
    const e = s.effect ?? {};
    const content = `
      <div class="hunt-dialog hunt-config">
        <label>Kind <select name="kind">
          <option value="tool" ${s.kind === "tool" ? "selected" : ""}>Tool (keeps its charges)</option>
          <option value="consumable" ${s.kind === "consumable" ? "selected" : ""}>Consumable (gone when used up)</option></select></label>
        <label>Charges <input type="number" name="usesMax" value="${s.usesMax}" min="0" step="1"> <span class="hunt-hint">0 = unlimited</span></label>
        <label>Charges left <input type="number" name="uses" value="${s.uses}" min="0" step="1"></label>
        <label>Usable on <select name="target">
          <option value="self" ${s.target === "self" ? "selected" : ""}>Yourself</option>
          <option value="ally" ${s.target === "ally" ? "selected" : ""}>Yourself or a targeted ally</option></select></label>
        <label>Health boxes cleared <input type="number" name="heal" value="${e.heal ?? 0}" min="0" step="1"></label>
        <label>Burned chunks restored <input type="number" name="unburn" value="${e.unburn ?? 0}" min="0" step="1"></label>
        <label>Conditions cured <input type="text" name="cure" value="${esc((e.cure ?? []).join(", "))}" placeholder="Bleeding, Poisoned…"></label>
        <label>Refills spare rounds <input type="checkbox" name="ammo" ${e.ammo ? "checked" : ""}></label>
        <label>Effect text <input type="text" name="text" value="${esc(e.text ?? "")}"></label>
        ${getSupport(item) ? `<label>Not a support item <input type="checkbox" name="remove"></label>` : ""}
      </div>`;
    const data = await foundry.applications.api.DialogV2.prompt({
        window: { title: `Support item — ${item.name}` },
        content,
        ok: {
            label: "Save", icon: "fas fa-save",
            callback: (event, button) => {
                const f = button.form.elements;
                const num = v => (v === "" || v === null ? 0 : Number(v));
                return {
                    remove: f.remove?.checked ?? false,
                    support: {
                        kind: f.kind.value, usesMax: num(f.usesMax.value), uses: num(f.uses.value), target: f.target.value,
                        effect: {
                            heal: num(f.heal.value), unburn: num(f.unburn.value),
                            cure: f.cure.value.split(",").map(c => c.trim()).filter(Boolean),
                            ammo: f.ammo.checked, text: f.text.value.trim()
                        }
                    }
                };
            }
        },
        rejectClose: false
    });
    if (!data) return;
    if (data.remove) return item.unsetFlag(MODULE_ID, "support");
    await item.update({ [`flags.${MODULE_ID}.support`]: data.support });
}

export function supportSummary(s) {
    const e = s.effect ?? {};
    const parts = [s.kind === "tool" ? "Tool" : "Consumable"];
    if (s.usesMax > 0) parts.push(`${s.uses}/${s.usesMax} charge${s.usesMax === 1 ? "" : "s"}`);
    if (e.heal) parts.push(`heals ${e.heal}`);
    if (e.unburn) parts.push(`restores ${e.unburn} chunk`);
    if (e.cure?.length) parts.push(`cures ${e.cure.join(", ")}`);
    if (e.ammo) parts.push("refills rounds");
    if (s.target === "ally") parts.push("self or ally");
    return parts.join(" · ");
}

/* Hunt: Showdown RPG — applying damage and conditions from an attack card.
 * The defender (owner of the target, or the GM) chooses which consequences absorb part of the hit;
 * the rest marks Health boxes from the last unburned chunk backward. Overflow = Downed.
 */

import { monsterData } from "./weapons.js";

const MODULE_ID = "hunt-showdown-fco";
const applied = new Set();

function esc(text) {
    return foundry.utils.escapeHTML(String(text ?? ""));
}

function trackEntry(actor, name) {
    const entry = Object.entries(actor.system.tracks ?? {}).find(([, t]) => t.name === name);
    return entry ? { key: entry[0], track: entry[1] } : null;
}

function isMarked(actor, name) {
    return !!trackEntry(actor, name)?.track?.box_values?.some(v => v);
}

/* Consequence slots still free: no box, absorbs harm, has an aspect, aspect not yet named. */
function freeConsequences(actor) {
    return Object.entries(actor.system.tracks ?? {})
        .filter(([, t]) => t.enabled !== false && (t.boxes ?? 0) === 0 && (t.harm_can_absorb ?? 0) > 0
            && t.aspect && typeof t.aspect === "object" && !t.aspect.name)
        .map(([key, t]) => ({ key, name: t.name, harm: t.harm_can_absorb }))
        .sort((a, b) => a.harm - b.harm);
}

/* Health boxes that can still be marked, highest index first (last unburned chunk backward). */
function healthState(actor) {
    const health = trackEntry(actor, "Health");
    if (!health) return null;
    const values = [...(health.track.box_values ?? [])];
    const burned = (trackEntry(actor, "Burned")?.track?.box_values ?? []).filter(v => v).length;
    const usable = Math.max(0, values.length - burned * 2);
    const free = [];
    for (let i = usable - 1; i >= 0; i--) if (!values[i]) free.push(i);
    return { key: health.key, values, usable, free };
}

export async function applyFromMessage(message, index = null) {
    const data = index === null ? message.getFlag(MODULE_ID, "result") : message.getFlag(MODULE_ID, "results")?.[index];
    const appliedKey = `${message.id}:${index ?? ""}`;
    if (!data?.target) return;
    const target = await fromUuid(data.target);
    const actor = target?.actor ?? target;
    if (!actor) return ui.notifications.warn("The target no longer exists.");
    if (!actor.isOwner) return ui.notifications.warn(`Only ${actor.name}'s owner or the GM can apply this.`);
    if (applied.has(appliedKey)) {
        const again = await foundry.applications.api.DialogV2.confirm({
            window: { title: "Apply again?" },
            content: "<p>You already applied this attack. Apply it a second time?</p>",
            rejectClose: false
        });
        if (!again) return;
    }

    // Monster defences: armour, kill on a Vital hit, immunities.
    const monster = monsterData(actor);
    let damage = data.damage;
    const notes = [];
    let instantKill = false;
    if (monster) {
        if (monster.vitalKills && data.vital) { instantKill = true; notes.push("Vital hit: killed outright"); }
        else if ((data.fire || (data.conditions ?? []).includes("Burning")) && monster.category !== "boss" && !monster.fireproof && !(monster.immune ?? []).includes("Burning")) {
            instantKill = true; notes.push("fire: burned to death");
        }
        else if (monster.armor && damage > 0) {
            const before = damage;
            damage = Math.max(0, damage - Number(monster.armor));
            notes.push(`armour −${before - damage}`);
        }
    }
    const immune = new Set(monster?.immune ?? []);

    const health = healthState(actor);
    if (!health) return ui.notifications.warn(`${actor.name} has no Health track. Is the Hunt rules install done on this character?`);
    const consequences = damage > 0 && !instantKill ? freeConsequences(actor) : [];
    const conditions = (data.conditions ?? []).filter(c => !immune.has(c));
    const bleedingAlready = isMarked(actor, "Bleeding");

    const content = `
      <div class="hunt-dialog hunt-apply">
        <p><strong>${esc(actor.name)}</strong> takes <span class="hunt-damage">${damage} damage</span>${notes.length ? ` <span class="hunt-hint">(${notes.join(", ")})</span>` : ""}.
           Health: ${health.free.length} free box(es)${health.usable < health.values.length ? `, ${health.values.length - health.usable} burned` : ""}.</p>
        ${consequences.length ? `<fieldset><legend>Absorb with consequences</legend>
          ${consequences.map(c => `<label><input type="checkbox" name="cons" value="${c.key}" data-harm="${c.harm}"> ${esc(c.name)} (${c.harm})
              <input type="text" name="aspect_${c.key}" placeholder="Name the wound"></label>`).join("")}
        </fieldset>` : ""}
        ${conditions.length ? `<fieldset><legend>Conditions</legend>
          ${conditions.map(c => `<label><input type="checkbox" name="cond" value="${esc(c)}" checked> ${esc(c)}</label>`).join("")}
        </fieldset>` : ""}
        ${immune.size ? `<p class="hunt-hint">Immune to ${[...immune].map(esc).join(", ")}.</p>` : ""}
        ${data.dread > 0 && data.damage > 0 && trackEntry(actor, "Dread") ? `<p class="hunt-hint">Monster hit: a Will roll against dread ${data.dread} follows.</p>` : ""}
        ${damage > 0 && bleedingAlready ? `<p class="hunt-hint">Already Bleeding: this hit turns it into Heavy Bleeding.</p>` : ""}
        <p class="hunt-preview"></p>
      </div>`;

    const preview = (root) => {
        const harm = [...root.querySelectorAll('input[name="cons"]:checked')].reduce((s, el) => s + Number(el.dataset.harm), 0);
        if (instantKill) { const o = root.querySelector(".hunt-preview"); if (o) o.innerHTML = `<strong class="hunt-damage">Killed</strong>`; return; }
        const rest = Math.max(0, damage - harm);
        const boxes = Math.min(rest, health.free.length);
        const down = rest > health.free.length;
        const out = root.querySelector(".hunt-preview");
        if (out) out.innerHTML = damage > 0
            ? `Consequences absorb ${Math.min(harm, damage)} · ${boxes} Health box(es) marked${down ? ` · <strong class="hunt-damage">Downed</strong>` : ""}`
            : "";
    };

    const choice = await foundry.applications.api.DialogV2.prompt({
        window: { title: `Apply — ${actor.name}` },
        content,
        render: (event, dialog) => {
            const root = dialog.element;
            preview(root);
            root.addEventListener("change", () => preview(root));
        },
        ok: {
            label: "Apply",
            icon: "fas fa-droplet",
            callback: (event, button) => {
                const form = button.form;
                return {
                    cons: [...form.querySelectorAll('input[name="cons"]:checked')].map(el => ({
                        key: el.value, harm: Number(el.dataset.harm),
                        aspect: form.elements[`aspect_${el.value}`]?.value?.trim()
                    })),
                    conds: [...form.querySelectorAll('input[name="cond"]:checked')].map(el => el.value)
                };
            }
        },
        rejectClose: false
    });
    if (!choice) return;

    const update = {};
    const summary = [];

    // Consequences, smallest first, until the damage is covered.
    let remaining = instantKill ? 0 : damage;
    for (const c of choice.cons) {
        if (remaining <= 0) break;
        const name = c.aspect || "Wounded";
        update[`system.tracks.${c.key}.aspect.name`] = name;
        remaining -= c.harm;
        summary.push(`${esc(actor.system.tracks[c.key].name)}: <em>${esc(name)}</em>`);
    }
    remaining = Math.max(0, remaining);

    // Health boxes.
    const values = [...health.values];
    let marked = 0;
    for (const i of health.free) {
        if (remaining <= 0) break;
        values[i] = true; remaining--; marked++;
    }
    if (marked) {
        update[`system.tracks.${health.key}.box_values`] = values;
        summary.push(`${marked} Health box${marked > 1 ? "es" : ""} marked`);
    }

    // Conditions.
    const conds = new Set(choice.conds);
    if (damage > 0 && bleedingAlready && !immune.has("Bleeding")) { conds.delete("Bleeding"); conds.add("Heavy Bleeding"); }
    if (conds.has("Heavy Bleeding")) {
        const b = trackEntry(actor, "Bleeding");
        if (b) update[`system.tracks.${b.key}.box_values`] = b.track.box_values.map(() => false);
    }
    if (remaining > 0 || instantKill) conds.add("Downed");
    const set = [];
    for (const name of conds) {
        const t = trackEntry(actor, name);
        if (!t) continue;
        update[`system.tracks.${t.key}.box_values`] = t.track.box_values.map((v, i) => i === 0 ? true : v);
        set.push(name);
    }

    // Dread: a monster's hit on a hunter calls for Will against its dread rating.
    const rolls = [];
    let dreadHtml = "";
    const dreadTrack = trackEntry(actor, "Dread");
    if (data.dread > 0 && data.damage > 0 && dreadTrack && !monster) {
        const roll = await new Roll("4dF").evaluate();
        roll.dice[0].options.sfx = { id: "fate4df", result: roll.result };
        rolls.push(roll);
        const will = Object.values(actor.system.skills ?? {}).find(sk => sk.name === "Will")?.rank ?? 0;
        const total = roll.total + will;
        if (total >= data.dread) {
            dreadHtml = `<div class="hunt-row">Will ${total} vs dread ${data.dread}: holds their nerve.</div>`;
        } else {
            const vals = [...dreadTrack.track.box_values];
            const idx = vals.indexOf(false);
            if (idx !== -1) vals[idx] = true;
            update[`system.tracks.${dreadTrack.key}.box_values`] = vals;
            const full = vals.every(v => v);
            dreadHtml = `<div class="hunt-row">Will ${total} vs dread ${data.dread}: <strong>Dread</strong> ${vals.filter(v => v).length}/${vals.length}${full ? " — <strong>Shaken</strong>" : ""}.</div>`;
            if (full) {
                const sh = trackEntry(actor, "Shaken");
                if (sh) { update[`system.tracks.${sh.key}.box_values`] = sh.track.box_values.map((v, i) => i === 0 ? true : v); set.push("Shaken"); }
            }
        }
    }

    if (Object.keys(update).length) await actor.update(update);
    applied.add(appliedKey);

    const downed = set.includes("Downed");
    if (downed && monster) {
        try { await actor.toggleStatusEffect("dead", { active: true, overlay: true }); } catch (e) { console.warn(e); }
    }
    await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="hunt-card">
          <div class="hunt-row"><strong>${esc(actor.name)}</strong> takes ${damage} damage${notes.length ? ` (${notes.join(", ")})` : ""}${summary.length ? `: ${summary.join(" · ")}` : ""}.</div>
          ${dreadHtml}
          ${set.length ? `<div class="hunt-row">Conditions: <strong>${set.map(esc).join(", ")}</strong></div>` : ""}
          ${downed ? (monster
              ? `<div class="hunt-result"><span class="hunt-damage">KILLED</span></div>`
              : `<div class="hunt-result"><span class="hunt-damage">DOWNED</span> — a teammate in the zone can revive (one chunk burns).</div>`) : ""}
        </div>`,
        rolls
    });
}

export function registerDamageHooks() {
    Hooks.on("renderChatMessageHTML", (message, html) => {
        for (const btn of html.querySelectorAll?.(".hunt-apply-btn") ?? []) {
            const idx = btn.dataset.index;
            btn.addEventListener("click", ev => { ev.preventDefault(); applyFromMessage(message, idx === undefined ? null : Number(idx)); });
        }
    });
}

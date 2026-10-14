/* Hunt: Showdown RPG — end of exchange: ongoing damage and effects.
 * Bleeding 1, Heavy Bleeding 2, Poisoned 1 (ends with Mithridatist), Burning marks 1 Health box and burns the chunk
 * it empties (Burned +1); a Burning hunter with no box left still loses a chunk. Overflow marks Downed.
 * Fire-killable monsters that are Burning die. Regeneration (shot) clears 1 box per exchange while it lasts.
 * Runs when the Combat Tracker advances a round, from the "End of Exchange" macro, or game.hunt.endOfExchange().
 */

import { MODULE_ID, monsterData } from "./weapons.js";
import { hasTrait } from "./support.js";

const TICKS = [
    { name: "Bleeding", damage: 1 },
    { name: "Heavy Bleeding", damage: 2 },
    { name: "Poisoned", damage: 1 }
];

function esc(text) {
    return foundry.utils.escapeHTML(String(text ?? ""));
}

function trackEntry(actor, name) {
    const entry = Object.entries(actor.system?.tracks ?? {}).find(([, t]) => t.name === name);
    return entry ? { key: entry[0], track: entry[1] } : null;
}

function isDead(actor) {
    return !!(actor.statuses?.has?.("dead") || actor.effects?.some?.(e => e.statuses?.has?.("dead")));
}

function isMarked(actor, name) {
    return !!trackEntry(actor, name)?.track?.box_values?.some(v => v);
}

/* Applies ongoing effects to one actor. Returns the lines for the chat card, or null if nothing happened. */
export async function tickActor(actor) {
    const health = trackEntry(actor, "Health");
    if (!health) return null;
    if (isMarked(actor, "Downed") || isDead(actor)) return null;
    const monster = monsterData(actor);
    const immune = new Set(monster?.immune ?? []);
    const values = [...(health.track.box_values ?? [])];
    const burnedTrack = trackEntry(actor, "Burned");
    const burned = [...(burnedTrack?.track.box_values ?? [])];
    const lines = [];
    const update = {};
    const conds = new Set();
    let killed = false;

    const usable = () => Math.max(0, values.length - burned.filter(v => v).length * 2);
    const markOne = () => {
        for (let i = usable() - 1; i >= 0; i--) if (!values[i]) { values[i] = true; return i; }
        return -1;
    };

    // Regeneration shot: one box back per exchange.
    const regen = Number(actor.getFlag(MODULE_ID, "regen") ?? 0);
    if (regen > 0 && !isMarked(actor, "Poisoned")) {
        const idx = values.findIndex((v, i) => v && i < usable());
        if (idx !== -1) { values[idx] = false; lines.push(`regenerates 1 Health box (${regen - 1} exchange${regen - 1 === 1 ? "" : "s"} left)`); }
        update[`flags.${MODULE_ID}.regen`] = regen - 1;
    } else if (regen > 0) {
        lines.push("Poisoned: no regeneration this exchange");
        update[`flags.${MODULE_ID}.regen`] = regen - 1;
    }

    // Plain damage over time.
    let damage = 0;
    const sources = [];
    for (const t of TICKS) {
        if (!isMarked(actor, t.name) || immune.has(t.name)) continue;
        damage += t.damage;
        sources.push(`${t.name} ${t.damage}`);
    }
    let marked = 0, overflow = 0;
    for (let i = 0; i < damage; i++) { if (markOne() !== -1) marked++; else overflow++; }
    if (damage) lines.push(`${sources.join(" + ")}: ${marked} Health box${marked === 1 ? "" : "es"} marked${overflow ? `, ${overflow} unabsorbed` : ""}`);

    // Fire.
    if (isMarked(actor, "Burning") && !immune.has("Burning")) {
        if (monster && monster.category !== "boss" && !monster.fireproof) {
            killed = true;
            lines.push("Burning: burned to death");
        } else {
            const idx = markOne();
            let burnt = false;
            if (idx !== -1) {
                const chunkStart = idx - (idx % 2);
                if (values[chunkStart] && values[chunkStart + 1]) burnt = true;
            } else {
                burnt = true; overflow++;
            }
            if (burnt) {
                const b = burned.indexOf(false);
                if (b !== -1) burned[b] = true;
            }
            lines.push(`Burning: ${idx !== -1 ? "1 Health box marked" : "no box left"}${burnt ? ", <strong>a Health chunk burns away</strong>" : ""}`);
        }
    }

    // Mithridatist: poison wears off at the end of the exchange.
    if (isMarked(actor, "Poisoned") && !monster && hasTrait(actor, "Mithridatist")) {
        const p = trackEntry(actor, "Poisoned");
        update[`system.tracks.${p.key}.box_values`] = p.track.box_values.map(() => false);
        lines.push("Mithridatist: Poisoned ends");
    }

    if (!lines.length) return null;

    if (values.some((v, i) => v !== health.track.box_values[i])) update[`system.tracks.${health.key}.box_values`] = values;
    if (burnedTrack && burned.some((v, i) => v !== burnedTrack.track.box_values[i])) update[`system.tracks.${burnedTrack.key}.box_values`] = burned;
    if (overflow > 0 || killed) conds.add("Downed");
    for (const name of conds) {
        const t = trackEntry(actor, name);
        if (t) update[`system.tracks.${t.key}.box_values`] = t.track.box_values.map((v, i) => i === 0 ? true : v);
    }
    await actor.update(update);
    if (conds.has("Downed")) {
        if (monster) {
            try { await actor.toggleStatusEffect("dead", { active: true, overlay: true }); } catch (e) { console.warn(e); }
            lines.push(`<strong class="hunt-damage">KILLED</strong>`);
        } else {
            lines.push(`<strong class="hunt-damage">DOWNED</strong>`);
        }
    }
    return lines;
}

/* An ablaze volatile monster sets fire to everyone right next to it (2 m). */
async function ablazeAura(scene) {
    const rows = [];
    if (!canvas?.ready || canvas.scene?.id !== scene.id) return rows;
    for (const tok of canvas.tokens.placeables) {
        const m = monsterData(tok.actor);
        if (!m?.volatile || !m.ignited || isDead(tok.actor) || isMarked(tok.actor, "Downed")) continue;
        const px = (2 / canvas.scene.grid.distance) * canvas.scene.grid.size;
        const caught = [];
        for (const other of canvas.tokens.placeables) {
            if (other === tok || !other.actor) continue;
            const reach = Math.hypot(other.center.x - tok.center.x, other.center.y - tok.center.y) - Math.min(other.w, other.h) / 2 - Math.min(tok.w, tok.h) / 2;
            if (reach > px) continue;
            const om = monsterData(other.actor);
            if (om && (om.fireproof || (om.immune ?? []).includes("Burning"))) continue;
            const b = trackEntry(other.actor, "Burning");
            if (!b || b.track.box_values?.[0]) continue;
            await other.actor.update({ [`system.tracks.${b.key}.box_values`]: b.track.box_values.map((v, i) => i === 0 ? true : v) });
            caught.push(other.name);
        }
        rows.push(`<div class="hunt-row"><strong>${esc(tok.name)}</strong> is ablaze${caught.length ? ` — sets fire to <strong>${caught.map(esc).join(", ")}</strong>` : ": nobody close enough"}.</div>`);
    }
    return rows;
}

/* All tokens of the active scene (GM only). */
export async function endOfExchange() {
    if (!game.user.isGM) return ui.notifications.warn("Only the GM runs the end of the exchange.");
    const scene = canvas?.scene ?? game.scenes.active;
    if (!scene) return;
    const seen = new Set();
    const rows = [];
    for (const tokDoc of scene.tokens) {
        const actor = tokDoc.actor;
        if (!actor || seen.has(actor.uuid)) continue;
        seen.add(actor.uuid);
        try {
            const lines = await tickActor(actor);
            if (lines) rows.push(`<div class="hunt-row"><strong>${esc(tokDoc.name)}</strong> — ${lines.join(" · ")}</div>`);
        } catch (e) { console.error("Hunt: end of exchange", tokDoc.name, e); }
    }
    rows.unshift(...(await ablazeAura(scene)));
    await ChatMessage.create({
        content: `<div class="hunt-card">
          <header class="hunt-card__head"><img src="modules/${MODULE_ID}/assets/exchange.svg" alt=""><div><h3>End of exchange</h3>
            <span class="hunt-hint">${esc(scene.name)} · bleeding, poison, fire, regeneration</span></div></header>
          ${rows.join("") || `<div class="hunt-row hunt-hint">Nobody is bleeding, poisoned or burning.</div>`}
        </div>`
    });
}

const MACRO_NAME = "End of Exchange";

/* A GM macro in a Hunt folder of the Macros directory, created once. */
export async function createExchangeMacro() {
    if (!game.user.isGM) return 0;
    if (game.macros.find(m => m.name === MACRO_NAME && m.getFlag(MODULE_ID, "exchange"))) return 0;
    let folder = game.folders.find(f => f.type === "Macro" && f.name === "Hunt");
    if (!folder) folder = await Folder.create({ name: "Hunt", type: "Macro", color: "#5c4127" });
    await Macro.create({
        name: MACRO_NAME, type: "script", img: `modules/${MODULE_ID}/assets/exchange.svg`, folder: folder.id,
        command: "game.hunt.endOfExchange();",
        flags: { [MODULE_ID]: { exchange: true } }
    });
    return 1;
}

export function registerExchangeHooks() {
    // The Combat Tracker moving to a new round is the end of an exchange. updateCombat reaches every client,
    // whoever clicked; only the active GM runs it, once. Going back a round or starting the combat doesn't count.
    Hooks.on("updateCombat", (combat, changed, options) => {
        if (!("round" in changed) || game.users.activeGM?.id !== game.user.id) return;
        if (options?.direction !== undefined && options.direction < 0) return;
        const previous = Number(combat.previous?.round ?? 0);
        if (!(changed.round > previous) || previous < 1) return;
        if (combat.scene && canvas?.scene && combat.scene.id !== canvas.scene.id) return;
        endOfExchange();
    });
}

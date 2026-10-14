/* Hunt: Showdown RPG — Fate points.
 * Invoke: on a single-target attack card, the attacker's owner (attack) or the target's owner (defence) spends
 * 1 Fate point to invoke an aspect: +2, or reroll their four dice. A new card replaces the old one (its Apply
 * button is disabled) with the new result, its own Apply button and another Fate point button.
 * Start of Mission: every hunter's Fate points go back to their refresh.
 */

import { MODULE_ID, rollOutcome, rollDF, diceHtml, ladderLabel, INVOKE_BTN } from "./weapons.js";

function esc(text) {
    return foundry.utils.escapeHTML(String(text ?? ""));
}

function fatePoints(actor) {
    return actor?.system?.details?.fatePoints ?? null;
}

export function supersededBy(message) {
    return game.messages.find(m => m.getFlag(MODULE_ID, "supersedes") === message.id) ?? null;
}

function totals(c) {
    const inv = side => c.invokes.filter(i => i.side === side && i.mode === "plus2").length * 2;
    const attack = c.atkDice + c.mods + inv("attack");
    const defence = c.aware ? (c.defDice !== null ? c.defDice + c.defMods : Number(c.defEntered ?? 0)) : 0;
    const opposition = defence + inv("defence") + c.rangePenalty + c.cover;
    return { attack, defence, opposition, shifts: attack - opposition };
}

export async function invokeFromMessage(message) {
    const calc = message.getFlag(MODULE_ID, "calc");
    if (!calc) return;
    if (supersededBy(message)) return ui.notifications.warn("This attack was already changed by a Fate point: use the newest card.");
    const attacker = await fromUuid(calc.actorUuid);
    const targetDoc = calc.targetUuid ? await fromUuid(calc.targetUuid) : null;
    const defender = targetDoc?.actor ?? targetDoc ?? null;

    const sides = [];
    if (attacker?.isOwner) sides.push({ key: "attack", label: `Attack — ${attacker.name}`, actor: attacker });
    if (defender?.isOwner && calc.aware) sides.push({ key: "defence", label: `Defence — ${defender.name}`, actor: defender });
    if (!sides.length) return ui.notifications.warn("Only the attacker's or the defender's owner can spend a Fate point here.");

    const content = `
      <div class="hunt-dialog">
        <label>Who invokes <select name="side">${sides.map(s => `<option value="${s.key}">${esc(s.label)} (${fatePoints(s.actor)?.current ?? 0} FP)</option>`).join("")}</select></label>
        <label>Aspect invoked <input type="text" name="aspect" placeholder="e.g. Crack Shot, Thick Fog, Wounded Leg"></label>
        <label><input type="radio" name="mode" value="plus2" checked> +2 to the total</label>
        <label><input type="radio" name="mode" value="reroll"> Reroll the four dice</label>
        <p class="hunt-hint">Free invokes (from a created advantage, a tool, a stunt) cost no Fate point: tick the box.</p>
        <label>Free invoke <input type="checkbox" name="free"></label>
      </div>`;
    const choice = await foundry.applications.api.DialogV2.prompt({
        window: { title: `Fate point — ${calc.itemName}` },
        content,
        ok: {
            label: "Invoke", icon: "fas fa-star",
            callback: (e, b) => {
                const f = b.form.elements;
                return { side: f.side.value, aspect: f.aspect.value.trim(), mode: b.form.querySelector('input[name="mode"]:checked').value, free: f.free.checked };
            }
        },
        rejectClose: false
    });
    if (!choice) return;
    const side = sides.find(s => s.key === choice.side);
    if (choice.mode === "reroll" && side.key === "defence" && calc.defDice === null) return ui.notifications.warn("No defence roll to reroll: use +2.");

    if (!choice.free) {
        const fp = fatePoints(side.actor);
        if (!fp || fp.current < 1) return ui.notifications.warn(`${side.actor.name} has no Fate point left.`);
        await side.actor.update({ "system.details.fatePoints.current": fp.current - 1 });
    }

    const c = foundry.utils.deepClone(calc);
    c.invokes = [...(c.invokes ?? []), { side: side.key, mode: choice.mode, aspect: choice.aspect, free: choice.free, by: side.actor.name }];
    const rolls = [];
    let rerollHtml = "";
    if (choice.mode === "reroll") {
        const r = await rollDF(4);
        rolls.push(r);
        if (side.key === "attack") c.atkDice = r.total; else c.defDice = r.total;
        rerollHtml = `<div class="hunt-row">Reroll ${diceHtml(r)}</div>`;
    }
    const t = totals(c);
    const res = await rollOutcome(t.shifts, c);
    rolls.push(...res.rolls);

    const canApply = !!c.targetUuid && (res.damage > 0 || res.conditions.length);
    const invokeLine = `<strong>${esc(side.actor.name)}</strong> ${choice.free ? "uses a free invoke" : "spends a Fate point"}${choice.aspect ? ` on <em>${esc(choice.aspect)}</em>` : ""}: ${choice.mode === "plus2" ? `+2 to ${side.key}` : `rerolls the ${side.key}`}.`;
    const content2 = `
      <div class="hunt-card">
        <header class="hunt-card__head"><img src="${c.img}" alt=""><div><h3>${esc(c.itemName)} — invoked</h3>
          <span class="hunt-hint">${esc(attacker?.name ?? "")}${c.targetName ? ` → ${esc(c.targetName)}` : ""} · ${esc(c.band)} · replaces the card above</span></div></header>
        <div class="hunt-row">${invokeLine}</div>
        ${rerollHtml}
        <div class="hunt-row">${esc(c.skill)} total <strong>${t.attack}</strong> <span class="hunt-hint">${ladderLabel(t.attack)}</span> vs opposition <strong>${t.opposition}</strong>
          <span class="hunt-hint">(defence ${t.defence}${c.rangePenalty ? `, range +${c.rangePenalty}` : ""}${c.cover ? `, cover +${c.cover}` : ""}${c.invokes.some(i => i.side === "defence" && i.mode === "plus2") ? `, invokes +${c.invokes.filter(i => i.side === "defence" && i.mode === "plus2").length * 2}` : ""})</span></div>
        <div class="hunt-result">${res.outcome}</div>
        ${res.ballisticHtml}
        ${res.conditions.length && t.shifts > 0 ? `<div class="hunt-row">Conditions on target: <strong>${res.conditions.map(esc).join(", ")}</strong></div>` : ""}
        ${canApply ? `<button type="button" class="hunt-apply-btn"><i class="fas fa-droplet"></i> Apply to ${esc(c.targetName || "target")}</button>` : ""}
        ${INVOKE_BTN}
      </div>`;
    await ChatMessage.create({
        speaker: attacker ? ChatMessage.getSpeaker({ actor: attacker }) : undefined,
        content: content2,
        rolls,
        flags: { [MODULE_ID]: {
            attack: true, calc: c, supersedes: message.id,
            result: canApply ? { target: c.targetUuid, damage: res.damage, conditions: res.conditions, vital: res.vital, blunt: c.blunt, dread: c.dread } : null
        } }
    });
}

/* ------------------------------------------------------------ start of mission */

export async function startOfMission() {
    if (!game.user.isGM) return ui.notifications.warn("Only the GM starts a mission.");
    const hunters = game.actors.filter(a => a.type === "fate-core-official" && !a.getFlag(MODULE_ID, "monster") && !a.getFlag(MODULE_ID, "beetle") && !a.getFlag(MODULE_ID, "alarm") && !a.getFlag(MODULE_ID, "container") && a.hasPlayerOwner);
    const rows = [];
    for (const a of hunters) {
        const fp = fatePoints(a);
        if (!fp) continue;
        const refresh = Number(fp.refresh ?? 3);
        if (fp.current < refresh) await a.update({ "system.details.fatePoints.current": refresh });
        rows.push(`<div class="hunt-row"><strong>${esc(a.name)}</strong> — ${refresh} Fate point${refresh === 1 ? "" : "s"}${fp.current > refresh ? ` (keeps ${fp.current})` : ""}</div>`);
    }
    await ChatMessage.create({
        content: `<div class="hunt-card">
          <header class="hunt-card__head"><img src="modules/${MODULE_ID}/assets/logo.svg" alt=""><div><h3>New mission</h3>
            <span class="hunt-hint">Fate points back to refresh</span></div></header>
          ${rows.join("") || `<div class="hunt-row hunt-hint">No hunter owned by a player.</div>`}
        </div>`
    });
}

const MISSION_MACRO = "Start of Mission";

export async function createMissionMacro() {
    if (!game.user.isGM) return 0;
    if (game.macros.find(m => m.name === MISSION_MACRO && m.getFlag(MODULE_ID, "mission"))) return 0;
    let folder = game.folders.find(f => f.type === "Macro" && f.name === "Hunt");
    if (!folder) folder = await Folder.create({ name: "Hunt", type: "Macro", color: "#5c4127" });
    await Macro.create({
        name: MISSION_MACRO, type: "script", img: `modules/${MODULE_ID}/assets/logo.svg`, folder: folder.id,
        command: "game.hunt.startOfMission();",
        flags: { [MODULE_ID]: { mission: true } }
    });
    return 1;
}

export function registerFateHooks() {
    Hooks.on("renderChatMessageHTML", (message, html) => {
        const btn = html.querySelector?.(".hunt-invoke-btn");
        if (btn) btn.addEventListener("click", ev => { ev.preventDefault(); invokeFromMessage(message); });
        // A card replaced by a Fate point invoke: greyed out, no buttons.
        if (message.getFlag(MODULE_ID, "calc") && supersededBy(message)) {
            html.querySelector(".hunt-card")?.classList.add("hunt-superseded");
            for (const b of html.querySelectorAll(".hunt-apply-btn, .hunt-invoke-btn")) b.disabled = true;
        }
    });
    // When an invoke card appears, re-render the card it replaces.
    Hooks.on("createChatMessage", message => {
        const old = message.getFlag(MODULE_ID, "supersedes");
        if (old) ui.chat?.updateMessage?.(game.messages.get(old));
    });
}

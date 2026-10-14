/* Hunt: Showdown RPG — weapons.
 * A weapon is a Fate Core Official "Extra" item carrying flags[hunt-showdown-fco].weapon.
 * The character sheet gets a fire / reload / clear-jam / settings strip on each weapon extra.
 */

import { throwExplosive, resolveMulti, blastRadius } from "./explosives.js";
import { usesSlot, isEquipped, loadoutSummary } from "./loadout.js";
import { getSupport, useSupport, configureSupport, supportSummary } from "./support.js";
import { getLore, readItem, configureLore, loreSummary } from "./lore.js";
import { searchNearby, useKey } from "./locks.js";

export const MODULE_ID = "hunt-showdown-fco";
const SYSTEM_ID = "fate-core-official";

export const BANDS = ["Close", "Medium", "Long", "Extreme"];

// Extra shots allowed per weapon action (combat rules, "Extra shots").
export const ACTIONS = {
    single: { label: "Single shot", extra: 0 },
    bolt: { label: "Bolt action", extra: 0 },
    lever: { label: "Lever action", extra: 1 },
    pump: { label: "Pump action", extra: 1 },
    double: { label: "Double barrel / multiple barrels", extra: 1 },
    sa_revolver: { label: "Single-action revolver", extra: 1 },
    da_revolver: { label: "Double-action revolver", extra: 2 },
    semi: { label: "Semi-automatic", extra: 2 },
    melee: { label: "Melee", extra: 0 },
    natural: { label: "Natural attack (monster)", extra: 0 },
    thrown: { label: "Thrown", extra: 0 }
};

export const AMMO = {
    standard: { label: "Standard" },
    incendiary: { label: "Incendiary", note: "−1 power, the target gains Burning", power: -1, condition: "Burning" },
    poison: { label: "Poison", note: "−1 power, the target gains Poisoned", power: -1, condition: "Poisoned" },
    fmj: { label: "Full Metal Jacket", note: "ignores light cover" },
    hv: { label: "High Velocity", note: "+1 range band" },
    dumdum: { label: "Dumdum", note: "+1 power at Close, −1 beyond" }
};

const SKILLS = ["Shoot", "Fight", "Throw"];

// Actions that use no ammunition and never jam.
const NO_AMMO = ["melee", "natural"];
const NO_STRESS = ["melee", "natural", "thrown"];

export const DEFAULT_WEAPON = {
    skill: "Shoot",
    action: "single",
    power: { Close: null, Medium: null, Long: null, Extreme: null },
    best: "Close",
    capacity: 1,
    loaded: 1,
    reserve: 0,
    maxReserve: null,
    ammo: "standard",
    reliability: 3,
    stress: 0,
    slot: "Large",
    conditions: [],
    shape: "single",
    notes: "",
    tool: false,
    blunt: false,
    recoverable: false
};

export const SHAPES = {
    single: { label: "Single target" },
    area: { label: "Area (everyone in a zone)" },
    cone: { label: "Cone (everyone in front, in range)" }
};

/* Monster data on an actor (phases change attack and defence). */
export function monsterData(actor) {
    return actor?.getFlag(MODULE_ID, "monster") ?? null;
}

export function phaseBonus(actor, kind) {
    const m = monsterData(actor);
    const p = m?.phases?.[m.phase ?? 0];
    return p ? Number(p[kind] ?? 0) : 0;
}

/* ------------------------------------------------------------ helpers */

export function getWeapon(item) {
    const w = item?.getFlag(MODULE_ID, "weapon");
    if (!w) return null;
    return foundry.utils.mergeObject(foundry.utils.deepClone(DEFAULT_WEAPON), w, { inplace: false });
}

function skillRank(actor, name) {
    if (!actor) return 0;
    const skill = Object.values(actor.system.skills ?? {}).find(s => s.name === name);
    return skill?.rank ?? 0;
}

function hasCondition(actor, name) {
    const track = Object.values(actor?.system?.tracks ?? {}).find(t => t.name === name);
    return !!track?.box_values?.some(v => v);
}

export function ladderLabel(value) {
    const ladder = game.settings.get(SYSTEM_ID, "ladder") ?? {};
    const label = ladder[String(Math.max(-2, Math.min(10, value)))];
    const sign = value >= 0 ? `+${value}` : `${value}`;
    return label ? `${label} (${sign})` : sign;
}

function face(v) {
    return v > 0 ? "+" : v < 0 ? "−" : "0";
}

export function diceHtml(roll) {
    return roll.dice[0].results
        .map(r => `<span class="hunt-die hunt-die--${r.result > 0 ? "plus" : r.result < 0 ? "minus" : "blank"}">${face(r.result)}</span>`)
        .join("");
}

export async function rollDF(n) {
    const roll = await new Roll(`${n}dF`).evaluate();
    roll.dice[0].options.sfx = { id: "fate4df", result: roll.result };
    return roll;
}

function esc(text) {
    return foundry.utils.escapeHTML(String(text ?? ""));
}

/* Range: the power listed for each band, the weapon's best band, and High Velocity's extra band. */
function rangeInfo(weapon, band) {
    const idx = BANDS.indexOf(band);
    let power = weapon.power?.[band];
    let extended = false;
    if ((power === null || power === undefined || power === "") && weapon.ammo === "hv") {
        // One band beyond the furthest listed band, at that band's power.
        const listed = BANDS.filter(b => weapon.power?.[b] !== null && weapon.power?.[b] !== undefined && weapon.power?.[b] !== "");
        const far = listed.at(-1);
        if (far && BANDS.indexOf(far) + 1 === idx) { power = weapon.power[far]; extended = true; }
    }
    if (power === null || power === undefined || power === "") return null;
    let penalty = Math.abs(idx - BANDS.indexOf(weapon.best));
    return { power: Number(power), penalty, extended };
}

/* ------------------------------------------------------------ attack */

export async function attack(actor, item) {
    const weapon = getWeapon(item);
    if (!weapon) return;
    if (usesSlot(item) && !isEquipped(item)) return ui.notifications.warn(`${item.name} is holstered. Equip it first (toggle on the Extra).`);
    const jammed = weapon.stress >= weapon.reliability && !NO_STRESS.includes(weapon.action);
    if (jammed) return ui.notifications.warn(`${item.name} is jammed. Clear the jam first (Crafts vs Fair).`);
    const usesAmmo = !NO_AMMO.includes(weapon.action);
    if (usesAmmo && weapon.loaded < 1) return ui.notifications.warn(`${item.name} is empty. Reload first.`);

    if (weapon.shape && weapon.shape !== "single") return attackMulti(actor, item, weapon, usesAmmo);

    const targetToken = game.user.targets.first() ?? null;
    const target = targetToken?.actor ?? null;
    const maxExtra = Math.max(0, Math.min(ACTIONS[weapon.action]?.extra ?? 0, usesAmmo ? weapon.loaded - 1 : 0));
    const bands = BANDS.filter(b => rangeInfo(weapon, b));

    const content = `
      <div class="hunt-dialog">
        <p><strong>${esc(item.name)}</strong> — ${esc(weapon.skill)} ${ladderLabel(skillRank(actor, weapon.skill))}${target ? ` → <strong>${esc(target.name)}</strong>` : ""}</p>
        <label>Range <select name="band">${bands.map(b => `<option value="${b}" ${b === weapon.best ? "selected" : ""}>${b}${rangeInfo(weapon, b).extended ? " (HV)" : ""}</option>`).join("")}</select></label>
        <label>Cover <select name="cover"><option value="0">None</option><option value="1">Light (+1)</option><option value="2">Heavy (+2)</option></select></label>
        <label>Target aware <input type="checkbox" name="aware" ${target ? "checked" : ""}> <span class="hunt-hint">${target ? "rolls the target's Athletics" : "no target selected: Mediocre (+0) defence"}</span></label>
        ${!target ? `<label>Defence (if aware) <input type="number" name="defence" value="0" step="1"></label>` : ""}
        <label>Aimed (+2) <input type="checkbox" name="aim"></label>
        <label>Extra shots <input type="number" name="extra" value="0" min="0" max="${maxExtra}" step="1" ${maxExtra === 0 ? "disabled" : ""}> <span class="hunt-hint">max ${maxExtra}</span></label>
        <label>Other bonus <input type="number" name="bonus" value="0" step="1"> <span class="hunt-hint">invokes, stunts</span></label>
      </div>`;

    const data = await foundry.applications.api.DialogV2.prompt({
        window: { title: `Attack — ${item.name}` },
        content,
        ok: {
            label: "Fire",
            icon: "fas fa-crosshairs",
            callback: (event, button) => {
                const f = button.form.elements;
                return {
                    band: f.band.value,
                    cover: Number(f.cover.value),
                    aware: f.aware.checked,
                    defence: Number(f.defence?.value ?? 0),
                    aim: f.aim.checked,
                    extra: Math.max(0, Math.min(maxExtra, Number(f.extra.value || 0))),
                    bonus: Number(f.bonus.value || 0)
                };
            }
        },
        rejectClose: false
    });
    if (!data) return;
    data.targetUuid = targetToken?.document?.uuid ?? null;
    await resolveAttack(actor, item, weapon, target, data);
}

/* Area and Cone attacks: one roll, every targeted token defends with Athletics. */
async function attackMulti(actor, item, weapon, usesAmmo) {
    const targets = [...game.user.targets];
    const bands = BANDS.filter(b => rangeInfo(weapon, b));
    const shape = SHAPES[weapon.shape]?.label ?? weapon.shape;
    const maxExtra = Math.max(0, Math.min(ACTIONS[weapon.action]?.extra ?? 0, usesAmmo ? weapon.loaded - 1 : 0));
    const opts = await foundry.applications.api.DialogV2.prompt({
        window: { title: `${weapon.shape === "cone" ? "Cone" : "Area"} attack — ${item.name}` },
        content: `<div class="hunt-dialog">
            <p><strong>${esc(item.name)}</strong> — ${esc(shape)}. Target every token caught in it
              (${targets.length} targeted${targets.length ? `: ${targets.map(t => esc(t.name)).join(", ")}` : ""}).</p>
            <label>Range <select name="band">${bands.map(b => `<option ${b === weapon.best ? "selected" : ""}>${b}</option>`).join("")}</select></label>
            <label>Extra shots <input type="number" name="extra" value="0" min="0" max="${maxExtra}" step="1" ${maxExtra === 0 ? "disabled" : ""}> <span class="hunt-hint">max ${maxExtra} · + = +1 power for everyone hit</span></label>
            <label>Other bonus <input type="number" name="bonus" value="0" step="1"></label></div>`,
        ok: { label: "Attack", icon: "fas fa-burst", callback: (e, b) => ({
            band: b.form.elements.band.value, bonus: Number(b.form.elements.bonus.value || 0),
            extra: Math.max(0, Math.min(maxExtra, Number(b.form.elements.extra.value || 0))) }) },
        rejectClose: false
    });
    if (!opts) return;

    const range = rangeInfo(weapon, opts.band);
    const rank = skillRank(actor, weapon.skill);
    let mods = rank + opts.bonus + phaseBonus(actor, "attack") - range.penalty;
    const notes = [];
    if (range.penalty) notes.push(`range −${range.penalty}`);
    if (opts.bonus) notes.push(`bonus ${opts.bonus > 0 ? "+" : ""}${opts.bonus}`);
    if (phaseBonus(actor, "attack")) notes.push(`phase ${phaseBonus(actor, "attack") > 0 ? "+" : ""}${phaseBonus(actor, "attack")}`);
    if (hasCondition(actor, "Pinned")) { mods -= 2; notes.push("Pinned −2"); }
    if (hasCondition(actor, "Shaken") && weapon.skill !== "Fight") { mods -= 1; notes.push("Shaken −1"); }
    if (hasCondition(actor, "Poisoned")) { mods -= 1; notes.push("Poisoned −1"); }
    if (hasCondition(actor, "Blinded") && weapon.skill !== "Fight") { mods -= 2; notes.push("Blinded −2"); }
    const roll = await rollDF(4);
    const attackValue = roll.total + mods;

    // Extra shots (second barrel, pump, lever): each + adds 1 power, each − adds weapon stress.
    const extraRolls = [roll];
    let extraPlus = 0, extraMinus = 0, extraHtml = "";
    if (opts.extra > 0) {
        const er = await rollDF(opts.extra);
        extraRolls.push(er);
        const faces = er.dice[0].results.map(r => r.result);
        extraPlus = faces.filter(v => v > 0).length;
        extraMinus = faces.filter(v => v < 0).length;
        extraHtml = `<div class="hunt-row">Extra shots ${diceHtml(er)} <span class="hunt-hint">+ = +1 power · − = weapon stress</span></div>`;
    }
    const update = {};
    if (usesAmmo) update[`flags.${MODULE_ID}.weapon.loaded`] = Math.max(0, weapon.loaded - 1 - opts.extra);
    if (extraMinus && !NO_STRESS.includes(weapon.action)) {
        const stress = Math.min(weapon.reliability, weapon.stress + extraMinus);
        update[`flags.${MODULE_ID}.weapon.stress`] = stress;
        extraHtml += `<div class="hunt-row${stress >= weapon.reliability ? " hunt-jam" : ""}">Weapon stress ${stress}/${weapon.reliability}${stress >= weapon.reliability ? " — <strong>Jammed</strong>" : ""}</div>`;
    }
    if (Object.keys(update).length) await item.update(update);
    const ammo = AMMO[weapon.ammo] ?? AMMO.standard;
    let power = range.power + (usesAmmo ? (ammo.power ?? 0) : 0) + extraPlus;
    if (usesAmmo && weapon.ammo === "dumdum") power += opts.band === "Close" ? 1 : -1;
    const conditions = [...new Set([...(weapon.conditions ?? []), ...(usesAmmo && ammo.condition ? [ammo.condition] : [])])];

    await resolveMulti({
        actor, targets, title: `${item.name} — ${weapon.shape === "cone" ? "Cone" : "Area"}`, img: item.img,
        attackValue, power, conditions, fire: conditions.includes("Burning"),
        dread: Number(monsterData(actor)?.dread ?? 0), extraRolls,
        headerRows: `<div class="hunt-row">${esc(weapon.skill)} ${diceHtml(roll)} ${rank >= 0 ? "+" : ""}${rank}${notes.length ? ` <span class="hunt-hint">(${notes.join(", ")})</span>` : ""} = <strong>${attackValue}</strong> · ${opts.band}</div>${extraHtml}${usesAmmo ? `<div class="hunt-row hunt-hint">${1 + opts.extra} round${opts.extra ? "s" : ""} spent — ${Math.max(0, weapon.loaded - 1 - opts.extra)}/${weapon.capacity} loaded</div>` : ""}`
    });
}

/* Outcome of a single-target attack once the shifts are known: miss, near miss, or hit with the ballistic die.
 * calc: { power, extraPlus, ammoCondition, weaponConditions }. Also used again after a Fate point invoke. */
export async function rollOutcome(shifts, calc) {
    const rolls = [];
    let outcome, damage = 0, ballisticHtml = "", vital = false;
    const conditions = [];
    if (shifts < 0) {
        outcome = `<span class="hunt-miss">Miss</span>`;
    } else if (shifts === 0) {
        outcome = `<span class="hunt-tie">Near miss</span> — no damage, the target is <strong>Pinned</strong>.`;
        conditions.push("Pinned");
    } else {
        // Ballistic die, twice keep the better on success with style.
        const style = shifts >= 3;
        const ball = await rollDF(style ? 2 : 1);
        rolls.push(ball);
        const best = Math.max(...ball.dice[0].results.map(r => r.result));
        damage = shifts + calc.power + (calc.extraPlus ?? 0);
        let ballText;
        if (best > 0) { damage += 2; ballText = "<strong>Vital</strong>: +2 damage, the target gains <strong>Bleeding</strong>"; conditions.push("Bleeding"); }
        else if (best < 0) { damage = Math.max(1, damage - 2); ballText = "<strong>Graze</strong>: −2 damage (minimum 1)"; }
        else ballText = "<strong>Clean</strong> hit";
        damage = Math.max(1, damage);
        if (calc.ammoCondition) conditions.push(calc.ammoCondition);
        for (const c of calc.weaponConditions ?? []) conditions.push(c);
        vital = best > 0;
        ballisticHtml = `<div class="hunt-row">Ballistic ${diceHtml(ball)}${style ? " <em>(with style: better kept)</em>" : ""} → ${ballText}</div>`;
        const dmgParts = [`${shifts} shifts`, `power ${calc.power}`];
        if (calc.extraPlus) dmgParts.push(`extra shots +${calc.extraPlus}`);
        outcome = `<span class="hunt-hit">Hit${style ? " with style" : ""}</span> — <span class="hunt-damage">${damage} damage</span> <span class="hunt-hint">(${dmgParts.join(", ")}, then ballistic)</span>`;
    }
    return { outcome, damage, ballisticHtml, conditions: [...new Set(conditions)], vital, rolls };
}

export const INVOKE_BTN = `<button type="button" class="hunt-invoke-btn"><i class="fas fa-star"></i> Fate point</button>`;

async function resolveAttack(actor, item, weapon, target, opts) {
    const rolls = [];
    const lines = [];
    const range = rangeInfo(weapon, opts.band);
    const ammo = AMMO[weapon.ammo] ?? AMMO.standard;

    // ---- Attacker total
    const rank = skillRank(actor, weapon.skill);
    let mods = rank + opts.bonus + (opts.aim ? 2 : 0);
    const modNotes = [];
    if (opts.aim) modNotes.push("aimed +2");
    if (opts.bonus) modNotes.push(`bonus ${opts.bonus > 0 ? "+" : ""}${opts.bonus}`);
    const pAtk = phaseBonus(actor, "attack");
    if (pAtk) { mods += pAtk; modNotes.push(`phase ${pAtk > 0 ? "+" : ""}${pAtk}`); }
    if (hasCondition(actor, "Pinned")) { mods -= 2; modNotes.push("Pinned −2"); }
    if (hasCondition(actor, "Shaken") && weapon.skill !== "Fight") { mods -= 1; modNotes.push("Shaken −1"); }
    if (hasCondition(actor, "Poisoned")) { mods -= 1; modNotes.push("Poisoned −1"); }
    if (hasCondition(actor, "Blinded") && weapon.skill !== "Fight") { mods -= 2; modNotes.push("Blinded −2"); }

    const atkRoll = await rollDF(4);
    rolls.push(atkRoll);
    const attackTotal = atkRoll.total + mods;

    // ---- Opposition
    let defence = 0, defDice = null, defModsKept = 0;
    let defenceText = "unaware, Mediocre (+0)";
    if (opts.aware) {
        if (target) {
            const defRoll = await rollDF(4);
            rolls.push(defRoll);
            let defMods = skillRank(target, "Athletics");
            if (hasCondition(target, "Shaken")) defMods -= 1;
            if (hasCondition(target, "Poisoned")) defMods -= 1;
            defMods += phaseBonus(target, "defence");
            defence = defRoll.total + defMods;
            defDice = defRoll.total; defModsKept = defMods;
            defenceText = `Athletics ${diceHtml(defRoll)} ${defMods >= 0 ? "+" : ""}${defMods} = <strong>${defence}</strong>`;
        } else {
            defence = opts.defence;
            defenceText = `entered: ${defence}`;
        }
    }
    let cover = opts.cover;
    if (weapon.ammo === "fmj" && cover === 1) cover = 0;
    const opposition = defence + range.penalty + cover;
    const oppParts = [`defence ${defence}`];
    if (range.penalty) oppParts.push(`range +${range.penalty}`);
    if (opts.cover) oppParts.push(cover ? `cover +${cover}` : "light cover ignored (FMJ)");

    const shifts = attackTotal - opposition;

    // ---- Extra shots
    const extraResults = [];
    if (opts.extra > 0) {
        const extraRoll = await rollDF(opts.extra);
        rolls.push(extraRoll);
        for (const r of extraRoll.dice[0].results) extraResults.push(r.result);
    }
    const extraPlus = extraResults.filter(v => v > 0).length;
    const extraMinus = extraResults.filter(v => v < 0).length;

    // ---- Outcome
    let power = range.power + (ammo.power ?? 0);
    if (weapon.ammo === "dumdum") power += opts.band === "Close" ? 1 : -1;
    const calc = {
        actorUuid: actor.uuid, itemName: item.name, img: item.img, skill: weapon.skill, band: opts.band,
        targetUuid: opts.targetUuid ?? null, targetActorUuid: target?.uuid ?? null, targetName: target?.name ?? "",
        atkDice: atkRoll.total, mods, aware: !!opts.aware, defDice, defMods: defModsKept, defEntered: target ? null : defence,
        rangePenalty: range.penalty, cover, power, extraPlus,
        ammoCondition: ammo.condition && !NO_AMMO.includes(weapon.action) ? ammo.condition : null,
        weaponConditions: weapon.conditions ?? [], blunt: !!weapon.blunt, dread: Number(monsterData(actor)?.dread ?? 0),
        invokes: []
    };
    const res = await rollOutcome(shifts, calc);
    rolls.push(...res.rolls);
    const { outcome, damage, ballisticHtml, conditions, vital } = res;

    // ---- Update the weapon: ammo and weapon stress
    const update = {};
    const spent = NO_AMMO.includes(weapon.action) ? 0 : 1 + opts.extra;
    if (spent) update[`flags.${MODULE_ID}.weapon.loaded`] = Math.max(0, weapon.loaded - spent);
    let jamText = "";
    if (extraMinus) {
        const stress = Math.min(weapon.reliability, weapon.stress + extraMinus);
        update[`flags.${MODULE_ID}.weapon.stress`] = stress;
        jamText = stress >= weapon.reliability
            ? `<div class="hunt-row hunt-jam">Weapon stress ${stress}/${weapon.reliability} — <strong>Jammed</strong>. Clear it with Crafts vs Fair (+2).</div>`
            : `<div class="hunt-row">Weapon stress ${stress}/${weapon.reliability}</div>`;
    }
    if (Object.keys(update).length) await item.update(update);

    // ---- Apply button (damage and conditions on the target)
    const appliedConditions = [...new Set(conditions)];
    const canApply = !!opts.targetUuid && (damage > 0 || appliedConditions.length);
    const applyBtn = canApply
        ? `<button type="button" class="hunt-apply-btn"><i class="fas fa-droplet"></i> Apply to ${esc(target?.name ?? "target")}</button>`
        : "";

    // ---- Chat card
    const extraHtml = extraResults.length
        ? `<div class="hunt-row">Extra shots ${extraResults.map(v => `<span class="hunt-die hunt-die--${v > 0 ? "plus" : v < 0 ? "minus" : "blank"}">${face(v)}</span>`).join("")}
             <span class="hunt-hint">+ = +1 damage on a hit · 0 = missed round · − = weapon stress</span></div>`
        : "";
    const ammoLine = spent
        ? `<div class="hunt-row hunt-hint">${spent} round${spent > 1 ? "s" : ""} spent (${esc(ammo.label)}) — ${Math.max(0, weapon.loaded - spent)}/${weapon.capacity} loaded</div>`
        : "";
    const content = `
      <div class="hunt-card">
        <header class="hunt-card__head"><img src="${item.img}" alt=""><div><h3>${esc(item.name)}</h3>
          <span class="hunt-hint">${esc(actor.name)}${target ? ` → ${esc(target.name)}` : ""} · ${opts.band}</span></div></header>
        <div class="hunt-row">${esc(weapon.skill)} ${diceHtml(atkRoll)} ${rank >= 0 ? "+" : ""}${rank}${modNotes.length ? ` <span class="hunt-hint">(${modNotes.join(", ")})</span>` : ""} = <strong>${attackTotal}</strong> <span class="hunt-hint">${ladderLabel(attackTotal)}</span></div>
        <div class="hunt-row">Opposition ${opposition} <span class="hunt-hint">(${oppParts.join(", ")}; ${defenceText})</span></div>
        ${extraHtml}
        <div class="hunt-result">${outcome}</div>
        ${ballisticHtml}
        ${conditions.length && shifts > 0 ? `<div class="hunt-row">Conditions on target: <strong>${[...new Set(conditions)].join(", ")}</strong></div>` : ""}
        ${jamText}
        ${ammoLine}
        ${applyBtn}
        ${INVOKE_BTN}
      </div>`;

    await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content,
        rolls,
        flags: { [MODULE_ID]: { attack: true, calc, result: canApply ? { target: opts.targetUuid, damage, conditions: appliedConditions, vital, blunt: !!weapon.blunt, dread: Number(monsterData(actor)?.dread ?? 0) } : null } }
    });
}

/* ------------------------------------------------------------ reload & jam */

export async function reload(actor, item) {
    const w = getWeapon(item);
    if (!w || NO_AMMO.includes(w.action)) return;
    const need = w.capacity - w.loaded;
    if (need <= 0) return ui.notifications.info(`${item.name} is already full.`);
    if (w.reserve <= 0 && (w.recoverable || w.action === "thrown")) {
        // Thrown weapons are picked up again after the fight.
        await item.update({ [`flags.${MODULE_ID}.weapon.loaded`]: w.capacity });
        return ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="hunt-card"><div class="hunt-row">Recovers <strong>${esc(item.name)}</strong>: ${w.capacity} ready again.</div></div>`
        });
    }
    if (w.reserve <= 0) return ui.notifications.warn(`No spare ammunition for ${item.name}.`);
    const taken = Math.min(need, w.reserve);
    await item.update({
        [`flags.${MODULE_ID}.weapon.loaded`]: w.loaded + taken,
        [`flags.${MODULE_ID}.weapon.reserve`]: w.reserve - taken
    });
    ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="hunt-card"><div class="hunt-row">Reloads <strong>${esc(item.name)}</strong>: ${w.loaded + taken}/${w.capacity} loaded, ${w.reserve - taken} spare.</div></div>`
    });
}

export async function clearJam(actor, item) {
    const w = getWeapon(item);
    if (!w) return;
    if (w.stress <= 0) return ui.notifications.info(`${item.name} has no weapon stress.`);
    const roll = await rollDF(4);
    const rank = skillRank(actor, "Crafts");
    const total = roll.total + rank;
    const success = total >= 2;
    if (success) await item.update({ [`flags.${MODULE_ID}.weapon.stress`]: 0 });
    ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        rolls: [roll],
        content: `<div class="hunt-card"><header class="hunt-card__head"><img src="${item.img}" alt=""><div><h3>Clear jam — ${esc(item.name)}</h3></div></header>
          <div class="hunt-row">Crafts ${diceHtml(roll)} ${rank >= 0 ? "+" : ""}${rank} = <strong>${total}</strong> vs Fair (+2)</div>
          <div class="hunt-result">${success ? `<span class="hunt-hit">Cleared</span> — weapon stress back to 0.` : `<span class="hunt-miss">Still jammed</span>.`}</div></div>`
    });
}

/* ------------------------------------------------------------ settings dialog */

export async function configureWeapon(item) {
    const w = getWeapon(item) ?? foundry.utils.deepClone(DEFAULT_WEAPON);
    const opt = (obj, cur) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === cur ? "selected" : ""}>${esc(v.label ?? v)}</option>`).join("");
    const content = `
      <div class="hunt-dialog hunt-config">
        <label>Skill <select name="skill">${SKILLS.map(s => `<option ${s === w.skill ? "selected" : ""}>${s}</option>`).join("")}</select></label>
        <label>Action <select name="action">${opt(ACTIONS, w.action)}</select></label>
        <fieldset><legend>Power by range band (leave empty = out of range)</legend>
          ${BANDS.map(b => `<label>${b} <input type="number" name="power_${b}" value="${w.power?.[b] ?? ""}" step="1"></label>`).join("")}
          <label>Best band <select name="best">${BANDS.map(b => `<option ${b === w.best ? "selected" : ""}>${b}</option>`).join("")}</select></label>
        </fieldset>
        <label>Capacity <input type="number" name="capacity" value="${w.capacity}" min="0" step="1"></label>
        <label>Loaded <input type="number" name="loaded" value="${w.loaded}" min="0" step="1"></label>
        <label>Spare rounds <input type="number" name="reserve" value="${w.reserve}" min="0" step="1"></label>
        <label>Spare rounds when full <input type="number" name="maxReserve" value="${w.maxReserve ?? w.reserve}" min="0" step="1"> <span class="hunt-hint">what an ammo box refills to</span></label>
        <label>Ammo <select name="ammo">${opt(AMMO, w.ammo)}</select></label>
        <label>Reliability <input type="number" name="reliability" value="${w.reliability}" min="1" max="4" step="1"> <span class="hunt-hint">weapon stress boxes</span></label>
        <label>Weapon stress <input type="number" name="stress" value="${w.stress}" min="0" step="1"></label>
        ${w.explosive
            ? `<label>Blast radius (m) <input type="number" name="radius" value="${blastRadius(item.name, w.explosive)}" min="1" step="1"> <span class="hunt-hint">everyone inside is hit, friend or foe</span></label>`
            : `<label>Shape <select name="shape">${opt(SHAPES, w.shape ?? "single")}</select></label>`}
        <label>Conditions on hit <input type="text" name="conditions" value="${esc((w.conditions ?? []).join(", "))}" placeholder="Bleeding, Poisoned…"></label>
        <label>Slot <select name="slot">${["Small", "Medium", "Large"].map(s => `<option ${s === w.slot ? "selected" : ""}>${s}</option>`).join("")}</select></label>
        <label>Tool <input type="checkbox" name="tool" ${w.tool ? "checked" : ""}> <span class="hunt-hint">no weapon slot, counts as a tool (derringer, flare pistol, melee)</span></label>
        <label>Blunt <input type="checkbox" name="blunt" ${w.blunt ? "checked" : ""}> <span class="hunt-hint">dusters, hammers: never sets a volatile monster ablaze</span></label>
        <label>Notes <input type="text" name="notes" value="${esc(w.notes ?? "")}" placeholder="shown on the sheet"></label>
        ${getWeapon(item) ? `<label>Not a weapon <input type="checkbox" name="remove"> <span class="hunt-hint">remove the weapon data</span></label>` : ""}
      </div>`;

    const data = await foundry.applications.api.DialogV2.prompt({
        window: { title: `Weapon — ${item.name}` },
        content,
        ok: {
            label: "Save",
            icon: "fas fa-save",
            callback: (event, button) => {
                const f = button.form.elements;
                const num = (v, d = 0) => (v === "" || v === null ? d : Number(v));
                const power = {};
                for (const b of BANDS) power[b] = f[`power_${b}`].value === "" ? null : Number(f[`power_${b}`].value);
                return {
                    remove: f.remove?.checked ?? false,
                    weapon: {
                        skill: f.skill.value, action: f.action.value, power, best: f.best.value,
                        capacity: num(f.capacity.value), loaded: num(f.loaded.value), reserve: num(f.reserve.value),
                        maxReserve: num(f.maxReserve.value), tool: f.tool.checked, blunt: f.blunt.checked, notes: f.notes.value.trim(),
                        recoverable: w.recoverable ?? false,
                        ammo: f.ammo.value, reliability: Math.max(1, num(f.reliability.value, 3)),
                        stress: num(f.stress.value), slot: f.slot.value,
                        conditions: f.conditions.value.split(",").map(c => c.trim()).filter(Boolean),
                        shape: f.shape?.value ?? w.shape ?? "single",
                        radius: f.radius ? Number(f.radius.value || 0) : null
                    }
                };
            }
        },
        rejectClose: false
    });
    if (!data) return;
    if (data.remove) return item.unsetFlag(MODULE_ID, "weapon");
    if (w.explosive) data.weapon.explosive = { ...w.explosive, radius: data.weapon.radius || blastRadius(item.name, w.explosive) };
    if (w.explosive) data.weapon.shape = "area";
    delete data.weapon.radius;
    if (data.weapon.power[data.weapon.best] === null) {
        const first = BANDS.find(b => data.weapon.power[b] !== null);
        if (!first) return ui.notifications.warn("Give the weapon a power in at least one range band.");
        data.weapon.best = first;
    }
    await item.update({ [`flags.${MODULE_ID}.weapon`]: data.weapon });
}

/* ------------------------------------------------------------ sheet integration */

function weaponSummary(w) {
    if (w.explosive) {
        const power = Object.values(w.power ?? {}).find(v => v !== null && v !== undefined && v !== "") ?? 0;
        const tags = [w.explosive.sticky ? "sticky" : "", w.explosive.fire ? "fire" : "", ...(w.conditions ?? []), w.explosive.zoneAspect].filter(Boolean);
        const uses = w.capacity > 1 ? `${w.loaded}/${w.capacity} charges` : "single use";
        return `Throw · power ${power} · radius ${blastRadius("", w.explosive)} m${tags.length ? ` · ${tags.join(", ")}` : ""} · ${uses}${w.notes ? ` · ${w.notes}` : ""}`;
    }
    const bands = BANDS.filter(b => w.power?.[b] !== null && w.power?.[b] !== undefined)
        .map(b => `${b[0]}${b === w.best ? "*" : ""}:${w.power[b]}`).join(" ");
    const ammo = NO_AMMO.includes(w.action) ? "" : ` · ${w.loaded}/${w.capacity} (+${w.reserve})${w.ammo !== "standard" ? ` ${AMMO[w.ammo]?.label}` : ""}`;
    const stress = NO_STRESS.includes(w.action) ? "" :
        ` · ${"■".repeat(Math.min(w.stress, w.reliability))}${"□".repeat(Math.max(0, w.reliability - w.stress))}${w.stress >= w.reliability ? " JAMMED" : ""}`;
    const conds = (w.conditions ?? []).length ? ` · ${w.conditions.join(", ")}` : "";
    const shapeTag = w.shape && w.shape !== "single" ? ` · ${w.shape}` : "";
    const notes = w.notes ? ` · ${w.notes}` : "";
    return `${w.skill}${shapeTag} · ${bands}${ammo}${stress}${conds}${notes}`;
}

export function decorateSheet(app, html) {
    try { decorateSheetInner(app, html); } catch (e) { console.error("Hunt: weapon tools failed", e); }
}

function decorateSheetInner(app, html) {
    const actor = app.document;
    if (!actor || actor.type !== SYSTEM_ID) return;
    const root = html instanceof HTMLElement ? html : html[0];
    const editable = actor.isOwner;

    // Loadout line at the top of the Extras panel (hunters only).
    const body = root.querySelector('[name="extras_body"]');
    const isProp = !!(actor.getFlag(MODULE_ID, "container") || actor.getFlag(MODULE_ID, "beetle") || actor.getFlag(MODULE_ID, "alarm"));
    let summary = "";
    try { if (!isProp) summary = loadoutSummary(actor); } catch (e) { console.error("Hunt loadout:", e); }
    if (body && summary && !body.querySelector(".hunt-loadout")) {
        const div = document.createElement("div");
        div.className = "hunt-loadout";
        div.textContent = summary;
        if (editable && !monsterData(actor)) {
            const b = document.createElement("button");
            b.type = "button"; b.className = "hunt-btn fu_button hunt-search-btn";
            b.innerHTML = `<i class="fas fa-magnifying-glass"></i> Search`;
            b.title = "Search the chest, desk or locked door within reach (targeted first)";
            b.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); searchNearby(actor); });
            div.append(" ", b);
        }
        body.prepend(div);
    }

    for (const header of root.querySelectorAll(".item_header[data-item-id]")) {
        const item = actor.items.get(header.dataset.itemId);
        if (!item) continue;
        const row = header.querySelector(".fate-extras__row-header");
        if (!row || row.querySelector(".hunt-weapon-tools")) continue;
        const weapon = getWeapon(item);
        const support = weapon ? null : getSupport(item);
        const lore = weapon || support ? null : getLore(item);

        const tools = document.createElement("span");
        tools.className = "hunt-weapon-tools";
        const btn = (icon, title, fn) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = `hunt-btn fu_button fas ${icon}`;
            b.title = title;
            b.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); fn(); });
            tools.append(b);
        };
        const holstered = weapon && usesSlot(item) && !isEquipped(item);
        if (weapon && editable && holstered) {
            btn("fa-hand-fist", "Equip this weapon", async () => {
                try { await item.update({ "system.active": true }); } catch (e) { console.error(e); }
            });
        }
        if (weapon && editable && !holstered) {
            if (weapon.explosive) {
                btn("fa-bomb", "Throw", () => throwExplosive(actor, item));
            } else {
                btn("fa-crosshairs", "Attack", () => attack(actor, item));
                if (!NO_AMMO.includes(weapon.action)) btn("fa-rotate", "Reload", () => reload(actor, item));
            }
            if (weapon.stress > 0) btn("fa-wrench", "Clear jam (Crafts vs Fair)", () => clearJam(actor, item));
        }
        if (lore) {
            btn("fa-book-open", "Read", () => readItem(item));
            if (lore.kind === "key" && editable) btn("fa-key", "Use the key on a lock within reach", () => useKey(actor, item));
            if (game.user.isGM) btn("fa-feather-pointed", "Lore settings", () => configureLore(item));
        }
        if (support && editable) btn("fa-hand-holding-medical", "Use", () => useSupport(actor, item));
        if (editable && !support && !lore) btn("fa-gun", weapon ? "Weapon settings" : "Make this extra a weapon", () => configureWeapon(item));
        if (editable && !weapon && !lore) btn("fa-kit-medical", support ? "Support item settings" : "Make this extra a support item", () => configureSupport(item));
        row.append(tools);

        if (lore) {
            const line = document.createElement("div");
            line.className = "hunt-weapon-summary hunt-lore-summary";
            line.textContent = loreSummary(lore);
            row.after(line);
        }
        if (support) {
            const line = document.createElement("div");
            line.className = "hunt-weapon-summary";
            line.textContent = supportSummary(support);
            row.after(line);
        }
        if (weapon) {
            const line = document.createElement("div");
            line.className = "hunt-weapon-summary";
            line.textContent = `${holstered ? "Holstered · " : ""}${weaponSummary(weapon)}`;
            if (holstered) line.classList.add("hunt-holstered");
            row.after(line);
        }
    }
}

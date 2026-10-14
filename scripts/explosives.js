/* Hunt: Showdown RPG — throwing explosives.
 * An explosive is a weapon Extra (skill Throw, action "thrown") with weapon.explosive:
 *   { blast: true, sticky: false, fire: false, zoneAspect: "", conditions: [] }
 * Step 1, Throw: Throw vs a difficulty set by distance; on a failure the scatter die says where it lands.
 * Step 2, Detonate (button on the throw card): uses the clicking user's CURRENT targets, so they can
 * target the tokens actually in the blast zone. Each target defends with Athletics against the throw
 * result (Fair +2 if the throw failed); each hit gets its own Apply button.
 */

import { MODULE_ID, getWeapon, monsterData, phaseBonus } from "./weapons.js";

const DISTANCES = {
    same: { label: "Same zone", difficulty: 1, ladder: "Average (+1)" },
    adjacent: { label: "Adjacent zone", difficulty: 2, ladder: "Fair (+2)" },
    two: { label: "Two zones away (Pitcher)", difficulty: 4, ladder: "Great (+4)" }
};

function esc(text) {
    return foundry.utils.escapeHTML(String(text ?? ""));
}

function face(v) {
    return v > 0 ? "+" : v < 0 ? "−" : "0";
}

function diceHtml(roll) {
    return roll.dice[0].results
        .map(r => `<span class="hunt-die hunt-die--${r.result > 0 ? "plus" : r.result < 0 ? "minus" : "blank"}">${face(r.result)}</span>`)
        .join("");
}

async function rollDF(n) {
    const roll = await new Roll(`${n}dF`).evaluate();
    roll.dice[0].options.sfx = { id: "fate4df", result: roll.result };
    return roll;
}

function skillRank(actor, name) {
    return Object.values(actor?.system?.skills ?? {}).find(s => s.name === name)?.rank ?? 0;
}

function hasCondition(actor, name) {
    return !!Object.values(actor?.system?.tracks ?? {}).find(t => t.name === name)?.box_values?.some(v => v);
}

function blastPower(weapon) {
    const p = Object.values(weapon.power ?? {}).find(v => v !== null && v !== undefined && v !== "");
    return Number(p ?? 0);
}

/* ------------------------------------------------------------ throw */

export async function throwExplosive(actor, item) {
    const weapon = getWeapon(item);
    const ex = weapon?.explosive;
    if (!ex) return;

    const targets = [...game.user.targets];
    const sticky = !!ex.sticky;
    const content = `
      <div class="hunt-dialog">
        <p><strong>${esc(item.name)}</strong> — Throw ${skillRank(actor, "Throw") >= 0 ? "+" : ""}${skillRank(actor, "Throw")} · power ${blastPower(weapon)}${ex.fire ? " · fire" : ""}</p>
        ${sticky
            ? `<p>Sticky: thrown at a person (Throw vs their Athletics). ${targets.length === 1 ? `Target: <strong>${esc(targets[0].name)}</strong>.` : `<span class="hunt-hint">Target exactly one token.</span>`}</p>`
            : `<label>Target zone <select name="distance">${Object.entries(DISTANCES).map(([k, d]) => `<option value="${k}" ${k === "adjacent" ? "selected" : ""}>${d.label} — ${d.ladder}</option>`).join("")}</select></label>`}
        <label>Other bonus <input type="number" name="bonus" value="0" step="1"> <span class="hunt-hint">invokes, stunts</span></label>
      </div>`;

    const opts = await foundry.applications.api.DialogV2.prompt({
        window: { title: `Throw — ${item.name}` },
        content,
        ok: {
            label: "Throw", icon: "fas fa-bomb",
            callback: (e, b) => ({ distance: b.form.elements.distance?.value ?? "same", bonus: Number(b.form.elements.bonus.value || 0) })
        },
        rejectClose: false
    });
    if (!opts) return;
    if (sticky && targets.length !== 1) return ui.notifications.warn("A sticky bomb needs exactly one targeted token.");

    const rolls = [];
    const rank = skillRank(actor, "Throw");
    let mods = rank + opts.bonus + phaseBonus(actor, "attack");
    const notes = [];
    if (opts.bonus) notes.push(`bonus ${opts.bonus > 0 ? "+" : ""}${opts.bonus}`);
    if (hasCondition(actor, "Shaken")) { mods -= 1; notes.push("Shaken −1"); }
    if (hasCondition(actor, "Blinded")) { mods -= 2; notes.push("Blinded −2"); }
    if (hasCondition(actor, "Poisoned")) { mods -= 1; notes.push("Poisoned −1"); }
    const roll = await rollDF(4);
    rolls.push(roll);
    const total = roll.total + mods;

    let difficulty, oppText, stuck = null;
    if (sticky) {
        const t = targets[0].actor;
        const def = await rollDF(4);
        rolls.push(def);
        const dm = skillRank(t, "Athletics") + phaseBonus(t, "defence") - (hasCondition(t, "Shaken") ? 1 : 0);
        difficulty = def.total + dm;
        oppText = `${esc(t.name)}'s Athletics ${diceHtml(def)} ${dm >= 0 ? "+" : ""}${dm} = ${difficulty}`;
        stuck = targets[0].document.uuid;
    } else {
        difficulty = DISTANCES[opts.distance].difficulty;
        oppText = `${DISTANCES[opts.distance].label}: ${DISTANCES[opts.distance].ladder}`;
    }
    const success = total >= difficulty;

    let landing;
    if (success) {
        landing = sticky ? `<strong>Stuck</strong> to ${esc(targets[0].name)}.` : `<strong>On target.</strong>`;
    } else if (sticky) {
        landing = `Misses ${esc(targets[0].name)} and lands at their feet: it still goes off in their zone.`;
        stuck = null;
    } else {
        const sc = await rollDF(1);
        rolls.push(sc);
        const v = sc.dice[0].results[0].result;
        landing = `Scatter ${diceHtml(sc)} → ${v > 0 ? "lands <strong>one zone beyond</strong> the target zone"
            : v < 0 ? "lands in <strong>the thrower's own zone</strong>" : "falls <strong>short</strong>, one zone toward the thrower"}.`;
    }

    // Explosives are single use: the item leaves the sheet once thrown. Multi-charge items (fusees) spend a charge.
    const charges = Number(weapon.capacity ?? 1);
    const left = Math.max(0, Number(weapon.loaded ?? 1) - 1);
    if (charges > 1 && left > 0) await item.update({ [`flags.${MODULE_ID}.weapon.loaded`]: left });
    else if (item.parent) await item.delete();
    const useText = charges > 1 ? `${left}/${charges} charges left` : "single use";

    const attackValue = success ? total : 2;
    await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        rolls,
        content: `
          <div class="hunt-card">
            <header class="hunt-card__head"><img src="${item.img}" alt=""><div><h3>${esc(item.name)}</h3>
              <span class="hunt-hint">${esc(actor.name)} throws · ${useText}</span></div></header>
            <div class="hunt-row">Throw ${diceHtml(roll)} ${rank >= 0 ? "+" : ""}${rank}${notes.length ? ` <span class="hunt-hint">(${notes.join(", ")})</span>` : ""} = <strong>${total}</strong> vs ${oppText}</div>
            <div class="hunt-result">${success ? `<span class="hunt-hit">Success</span>` : `<span class="hunt-miss">Failure</span>`} — ${landing}</div>
            <div class="hunt-row hunt-hint">Goes off at the end of the exchange (Cooked Fuse: at once). Blast radius ${blastRadius(item.name, ex)} m. Defence: Athletics vs <strong>${attackValue}</strong>${ex.zoneAspect ? ` · the zone gains <em>${esc(ex.zoneAspect)}</em>` : ""}.</div>
            <button type="button" class="hunt-detonate-btn"><i class="fas fa-explosion"></i> Detonate — click the impact point</button>
          </div>`,
        flags: { [MODULE_ID]: { throw: {
            actorUuid: actor.uuid, itemName: item.name, img: item.img, attackValue,
            power: blastPower(weapon), fire: !!ex.fire, conditions: [...(ex.conditions ?? []), ...(weapon.conditions ?? [])],
            zoneAspect: ex.zoneAspect ?? "", stuck, radius: blastRadius(item.name, ex)
        } } }
    });
}

/* ------------------------------------------------------------ detonate */

/* ------------------------------------------------------------ blast radius */

// Default radii in metres, used for items created before radii existed.
export const DEFAULT_RADII = {
    "Dynamite Stick": 5, "Frag Bomb": 6, "Concertina Bomb": 4, "Fire Bomb": 4,
    "Hellfire Bomb": 6, "Sticky Bomb": 4, "Choke Bomb": 5
};

export function blastRadius(name, ex) {
    const r = Number(ex?.radius);
    return r > 0 ? r : (DEFAULT_RADII[name] ?? 5);
}

/* Radius in metres → pixels on the current scene (feet scenes are converted). */
export function radiusPixels(metres) {
    const grid = canvas.scene.grid;
    const feet = /^(ft|feet|foot|pi|pied|pieds|')\.?$/i.test(String(grid.units ?? "").trim());
    const units = feet ? metres * 3.28084 : metres;
    return units / grid.distance * grid.size;
}

/* Waits for a left click on the map; resolves to canvas coordinates, or null on right click / Escape. */
function pickPoint(label) {
    return new Promise(resolve => {
        const view = canvas.app.view;
        ui.notifications.info(`${label}: click where it lands (right click or Escape to cancel).`);
        const done = (value) => {
            view.removeEventListener("pointerdown", onDown, true);
            window.removeEventListener("keydown", onKey, true);
            view.style.cursor = "";
            resolve(value);
        };
        const onDown = (ev) => {
            ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
            if (ev.button !== 0) return done(null);
            done(canvas.canvasCoordinatesFromClient({ x: ev.clientX, y: ev.clientY }));
        };
        const onKey = (ev) => { if (ev.key === "Escape") { ev.preventDefault(); done(null); } };
        view.style.cursor = "crosshair";
        view.addEventListener("pointerdown", onDown, true);
        window.addEventListener("keydown", onKey, true);
    });
}

/* Draws the blast circle on the map for a few seconds. */
export function flashBlast(center, px, fire) {
    try {
        const g = new PIXI.Graphics();
        const colour = fire ? 0xe0573f : 0xd9a441;
        g.lineStyle(4, colour, 0.9).beginFill(colour, 0.18).drawCircle(center.x, center.y, px).endFill();
        g.lineStyle(2, colour, 0.6).drawCircle(center.x, center.y, px / 2);
        canvas.interface.addChild(g);
        setTimeout(() => { g.destroy(); }, 4000);
    } catch (e) { console.warn("Hunt: blast drawing", e); }
}

/* Every token in the radius, friend or foe, the thrower included. Hidden tokens only for the GM. */
export function tokensInBlast(center, px) {
    return canvas.tokens.placeables.filter(tok => {
        if (!tok.actor || (tok.document.hidden && !game.user.isGM)) return false;
        const c = tok.center;
        const reach = Math.hypot(c.x - center.x, c.y - center.y) - Math.min(tok.w, tok.h) / 2;
        tok._huntBlastEdge = reach > px / 2;
        return reach <= px;
    });
}

export async function detonate(message) {
    const t = message.getFlag(MODULE_ID, "throw");
    if (!t) return;
    const radius = Number(t.radius) || 5;
    const actor = await fromUuid(t.actorUuid);
    let targets = [];
    const perTarget = {};
    let header = "";

    if (canvas?.ready && canvas.scene) {
        let center = null;
        if (t.stuck) {
            const stuck = (await fromUuid(t.stuck))?.object;
            if (stuck) center = stuck.center;
        }
        if (!center) center = await pickPoint(`${t.itemName} (${radius} m)`);
        if (!center) return;
        const px = radiusPixels(radius);
        flashBlast(center, px, t.fire);
        targets = tokensInBlast(center, px);
        for (const tok of targets) {
            if (tok._huntBlastEdge) perTarget[tok.document.uuid] = { powerMod: -2, note: "edge of the blast, −2 power" };
        }
        header = `<div class="hunt-row hunt-hint">Blast radius ${radius} m: ${targets.length} caught, friend or foe. The outer half of the radius takes −2 power.</div>`;
    } else {
        targets = [...game.user.targets];
        header = `<div class="hunt-row hunt-hint">No map: the targeted tokens are caught in the blast.</div>`;
    }

    await resolveMulti({
        actor, targets, title: `${t.itemName} — Blast`, img: t.img,
        attackValue: t.attackValue, power: t.power, conditions: t.conditions, fire: t.fire,
        stuck: t.stuck, zoneAspect: t.zoneAspect, dread: 0, missLabel: "Clear of the blast",
        perTarget, headerRows: header
    });
}

/* One attack value against several targets: each defends with Athletics, each hit gets an Apply button.
 * Used by explosive blasts and by Area / Cone attacks. No ballistic die: spread attacks don't find the vitals. */
export async function resolveMulti({ actor, targets, title, img, attackValue, power, conditions = [], fire = false,
    stuck = null, zoneAspect = "", dread = 0, missLabel = "Avoids it", extraRolls = [], headerRows = "", perTarget = {} }) {
    const rolls = [...extraRolls];
    const results = [];
    const rows = [];
    for (const token of targets) {
        const a = token.actor;
        if (!a) continue;
        const uuid = token.document.uuid;
        let defence, defText;
        if (stuck && stuck === uuid) {
            defence = 0; defText = "stuck: no defence";
        } else {
            const r = await rollDF(4);
            rolls.push(r);
            const dm = skillRank(a, "Athletics") + phaseBonus(a, "defence")
                - (hasCondition(a, "Shaken") ? 1 : 0) - (hasCondition(a, "Poisoned") ? 1 : 0);
            defence = r.total + dm;
            defText = `Athletics ${diceHtml(r)} ${dm >= 0 ? "+" : ""}${dm} = ${defence}`;
        }
        const shifts = attackValue - defence;
        const pt = perTarget[uuid] ?? {};
        if (pt.note) defText += ` <span class="hunt-hint">(${esc(pt.note)})</span>`;
        let line;
        if (shifts > 0) {
            const damage = Math.max(1, shifts + Math.max(0, power + (pt.powerMod ?? 0)));
            const idx = results.length;
            results.push({ target: uuid, damage, conditions, vital: false, fire, dread });
            const m = monsterData(a);
            const burns = fire || conditions.includes("Burning");
            const fireKill = burns && m && m.category !== "boss" && !m.fireproof && !(m.immune ?? []).includes("Burning");
            line = `<span class="hunt-damage">${damage} damage</span>${fireKill ? ` <strong>(fire: lethal)</strong>` : ""}
                    <button type="button" class="hunt-apply-btn hunt-apply-inline" data-index="${idx}"><i class="fas fa-droplet"></i> Apply</button>`;
        } else if (shifts === 0) {
            line = `<span class="hunt-tie">Grazed</span> — no damage, <strong>Pinned</strong>
                    <button type="button" class="hunt-apply-btn hunt-apply-inline" data-index="${results.length}"><i class="fas fa-droplet"></i> Apply</button>`;
            results.push({ target: uuid, damage: 0, conditions: ["Pinned"], vital: false, fire: false, dread: 0 });
        } else {
            line = `<span class="hunt-miss">${esc(missLabel)}</span>`;
        }
        rows.push(`<div class="hunt-row"><strong>${esc(token.name)}</strong> — ${defText} → ${line}</div>`);
    }

    await ChatMessage.create({
        speaker: actor ? ChatMessage.getSpeaker({ actor }) : undefined,
        rolls,
        content: `
          <div class="hunt-card">
            <header class="hunt-card__head"><img src="${img}" alt=""><div><h3>${esc(title)}</h3>
              <span class="hunt-hint">attack ${attackValue} · power ${power}${fire ? " · fire" : ""}${conditions.length ? ` · ${conditions.map(esc).join(", ")}` : ""}</span></div></header>
            ${headerRows}
            ${rows.join("") || `<div class="hunt-row hunt-hint">No token targeted: nobody is caught.</div>`}
            ${zoneAspect ? `<div class="hunt-result">The zone gains <em>${esc(zoneAspect)}</em>.</div>` : ""}
          </div>`,
        flags: { [MODULE_ID]: { results } }
    });
}

export function registerExplosiveHooks() {
    Hooks.on("renderChatMessageHTML", (message, html) => {
        const btn = html.querySelector?.(".hunt-detonate-btn");
        if (!btn) return;
        btn.addEventListener("click", ev => { ev.preventDefault(); detonate(message); });
    });
}

/* Hunt: Showdown RPG — monsters.
 * A monster is a Fate Core Official actor with flags[hunt-showdown-fco].monster:
 *   { category, dread, armor, vitalKills, immune[], phases[{name, attack, defence, note}], phase }
 * Its attacks are Extras with weapon data (action "natural": no ammo, no jams).
 * Monsters are built from a plain spec, by the bestiary install and by the Monster Creator.
 */

import { BANDS, monsterData } from "./weapons.js";

const MODULE_ID = "hunt-showdown-fco";
const BESTIARY_PATH = `modules/${MODULE_ID}/data/bestiary.json`;
const FOLDER = "Hunt Bestiary";

export const CATEGORIES = {
    grunt: { label: "Grunt", img: `modules/${MODULE_ID}/assets/monster-grunt.svg` },
    elite: { label: "Elite", img: `modules/${MODULE_ID}/assets/monster-elite.svg` },
    boss: { label: "Boss", img: `modules/${MODULE_ID}/assets/monster-boss.svg` }
};
const MONSTER_SKILLS = ["Fight", "Shoot", "Athletics", "Physique", "Notice", "Stealth", "Will", "Provoke"];
const DEFAULT_PHASES = [
    { name: "Idle", attack: 0, defence: -1, note: "Unaware or wandering. Hunters may ambush it." },
    { name: "Attack", attack: 0, defence: 0, note: "Engaged with the hunters." },
    { name: "Rage", attack: 1, defence: -1, note: "Wounded and furious: hits harder, guards less." },
    { name: "Pursuit", attack: 0, defence: 1, note: "Chasing a fleeing hunter: moves two zones per exchange." }
];

function esc(text) {
    return foundry.utils.escapeHTML(String(text ?? ""));
}

function b64(text) {
    return fcoConstants.tob64(text);
}

/* World definitions (installed by the Hunt rules) used as templates for the monster's sheet. */
function worldDefs() {
    const wd = fcoConstants.wd();
    if (!wd) throw new Error("Fate Core Official world data not found.");
    return { skills: wd.system.skills ?? {}, tracks: wd.system.tracks ?? {} };
}

function byName(obj, name) {
    return Object.values(obj).find(x => x.name === name);
}

/* ------------------------------------------------------------ build */

export function buildMonster(spec, folderId = null) {
    const defs = worldDefs();
    const category = CATEGORIES[spec.category] ? spec.category : "grunt";

    const skills = {};
    for (const [name, rank] of Object.entries(spec.skills ?? {})) {
        const base = foundry.utils.deepClone(byName(defs.skills, name) ?? { name, description: "", overcome: "", caa: "", attack: "", defend: "" });
        base.rank = Number(rank) || 0;
        base.pc = false;
        skills[b64(name)] = base;
    }

    const tracks = {};
    const healthDef = byName(defs.tracks, "Health");
    if (!healthDef) throw new Error("Health track not found: install the Hunt rules first.");
    const health = foundry.utils.deepClone(healthDef);
    health.boxes = Math.max(1, Number(spec.health) || 1);
    health.box_values = Array(health.boxes).fill(false);
    health.description = `${health.boxes} boxes, each absorbs 1 damage.`;
    tracks[b64("Health")] = health;
    for (const t of Object.values(defs.tracks)) {
        if (t.category === "Conditions") tracks[b64(t.name)] = foundry.utils.deepClone(t);
    }
    if (spec.consequences) {
        for (const n of ["Mild Consequence", "Moderate Consequence", "Severe Consequence"]) {
            const t = byName(defs.tracks, n);
            if (t) tracks[b64(n)] = foundry.utils.deepClone(t);
        }
    }

    const stunts = {};
    for (const a of spec.abilities ?? []) {
        if (!a?.name) continue;
        stunts[b64(a.name)] = {
            name: a.name, description: `<p>${esc(a.text)}</p>`, notes: "", linked_skill: "None", refresh_cost: 0,
            overcome: false, caa: false, attack: false, defend: false, bonus: 0, boxes: 0, box_values: [], macro: null
        };
    }

    const aspects = {
        [b64("Nature")]: { name: "Nature", description: "What this creature is.", value: spec.aspect ?? "", notes: "" }
    };

    const phases = (category === "boss" || spec.phases?.length)
        ? (spec.phases?.length ? spec.phases : DEFAULT_PHASES).map(p => ({
            name: p.name, attack: Number(p.attack) || 0, defence: Number(p.defence) || 0, note: p.note ?? "" }))
        : [];

    const items = (spec.attacks ?? []).filter(a => a?.name).map(a => {
        const range = (a.range?.length ? a.range : ["Close"]).filter(b => BANDS.includes(b));
        const power = Object.fromEntries(BANDS.map(b => [b, range.includes(b) ? Number(a.power) || 0 : null]));
        return {
            name: a.name, type: "Extra", img: CATEGORIES[category].img,
            system: { description: { value: a.text ? `<p>${esc(a.text)}</p>` : "" } },
            flags: { [MODULE_ID]: { weapon: {
                skill: a.skill || "Fight", action: "natural", power, best: range[0] ?? "Close",
                capacity: 0, loaded: 0, reserve: 0, ammo: "standard", reliability: 4, stress: 0, slot: "Large",
                conditions: a.conditions ?? [], shape: a.shape ?? "single"
            } } }
        };
    });

    const fp = category === "boss" ? 2 : 0;
    return {
        name: spec.name,
        type: "fate-core-official",
        img: spec.img || CATEGORIES[category].img,
        folder: folderId,
        system: {
            details: {
                fatePoints: { refresh: fp, current: fp, boosts: 0 },
                description: { value: spec.description ? `<p>${esc(spec.description)}</p>` : "" },
                biography: { value: "" }, pronouns: { value: "" }, notes: { value: "", GM: true },
                sheet_mode: "full"
            },
            skills, tracks, stunts, aspects
        },
        items,
        prototypeToken: {
            name: spec.name, actorLink: false, disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
            texture: { src: spec.img || CATEGORIES[category].img },
            width: category === "boss" ? 2 : 1, height: category === "boss" ? 2 : 1
        },
        flags: { [MODULE_ID]: { monster: {
            category,
            dread: Number(spec.dread) || 0,
            armor: Number(spec.armor) || 0,
            vitalKills: !!spec.vitalKills,
            fireproof: !!spec.fireproof,
            volatile: !!spec.volatile,
            vitalPierces: !!spec.vitalPierces,
            deathBurst: spec.deathBurst ?? null,
            aura: spec.aura ?? null,
            immune: spec.immune ?? [],
            phases,
            phase: phases.length ? Math.min(phases.length - 1, Number(spec.startPhase ?? (category === "boss" ? 1 : 0))) : 0
        } } }
    };
}

async function getFolder() {
    return game.folders.find(f => f.type === "Actor" && f.name === FOLDER)
        ?? Folder.create({ name: FOLDER, type: "Actor", color: "#5c1e14" });
}

/* Creates the bestiary entries that are not in the Hunt Bestiary folder yet. */
export async function createBestiary() {
    if (!game.user.isGM) return 0;
    const specs = await (await fetch(BESTIARY_PATH)).json();
    const folder = await getFolder();
    const existing = new Set(game.actors.filter(a => a.folder?.id === folder.id).map(a => a.name));
    const docs = specs.filter(s => !existing.has(s.name)).map(s => buildMonster(s, folder.id));
    if (docs.length) await Actor.createDocuments(docs);
    return docs.length;
}

/* Replaces the bestiary monsters of the Hunt Bestiary folder that match these names (all if none given). */
export async function rebuildBestiary(names = null) {
    if (!game.user.isGM) return 0;
    const specs = (await (await fetch(BESTIARY_PATH)).json()).filter(s => !names || names.includes(s.name));
    const folder = await getFolder();
    const wanted = new Set(specs.map(s => s.name));
    const old = game.actors.filter(a => a.folder?.id === folder.id && wanted.has(a.name)).map(a => a.id);
    if (old.length) await Actor.deleteDocuments(old);
    await Actor.createDocuments(specs.map(s => buildMonster(s, folder.id)));
    return specs.length;
}

/* ------------------------------------------------------------ Monster Creator */

const ROWS_ATTACKS = 3, ROWS_ABILITIES = 3;

function creatorContent(spec) {
    const sk = spec.skills ?? {};
    const cat = spec.category ?? "grunt";
    const phases = spec.phases?.length ? spec.phases : DEFAULT_PHASES;
    const att = i => spec.attacks?.[i] ?? {};
    const abl = i => spec.abilities?.[i] ?? {};
    return `
    <div class="hunt-dialog hunt-creator">
      <div class="hunt-grid2">
        <label>Name <input type="text" name="name" value="${esc(spec.name ?? "")}" required></label>
        <label>Category <select name="category">${Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}" ${k === cat ? "selected" : ""}>${v.label}</option>`).join("")}</select></label>
        <label class="hunt-span2">Nature (aspect) <input type="text" name="aspect" value="${esc(spec.aspect ?? "")}" placeholder="Bloated Husk Drawn to Noise"></label>
        <label class="hunt-span2">Description <input type="text" name="description" value="${esc(spec.description ?? "")}"></label>
        <label class="hunt-span2">Image <input type="text" name="img" value="${esc(spec.img ?? "")}" placeholder="default by category"></label>
      </div>

      <fieldset><legend>Skills</legend><div class="hunt-grid4">
        ${MONSTER_SKILLS.map(n => `<label>${n} <input type="number" name="skill_${n}" value="${sk[n] ?? ""}" step="1"></label>`).join("")}
      </div></fieldset>

      <fieldset><legend>Toughness</legend><div class="hunt-grid4">
        <label>Health <input type="number" name="health" value="${spec.health ?? 2}" min="1" step="1"></label>
        <label>Armour <input type="number" name="armor" value="${spec.armor ?? 0}" min="0" step="1"></label>
        <label>Dread <input type="number" name="dread" value="${spec.dread ?? 1}" min="0" step="1"></label>
        <label>Consequences <input type="checkbox" name="consequences" ${spec.consequences ?? cat === "boss" ? "checked" : ""}></label>
        <label>Vital hit kills <input type="checkbox" name="vitalKills" ${spec.vitalKills ? "checked" : ""}></label>
        <label title="Fire does not kill it outright (bosses never die to fire alone)">Fireproof <input type="checkbox" name="fireproof" ${spec.fireproof ? "checked" : ""}></label>
        <label title="A Vital hit ignores its armour (instead of killing it outright)">Vital pierces armour <input type="checkbox" name="vitalPierces" ${spec.vitalPierces ? "checked" : ""}></label>
        <label title="A piercing or cutting hit that doesn't kill it sets it ablaze: fire blast on everyone around">Volatile <input type="checkbox" name="volatile" ${spec.volatile ? "checked" : ""}></label>
        <label class="hunt-span2">Immune to <input type="text" name="immune" value="${esc((spec.immune ?? []).join(", "))}" placeholder="Burning, Poisoned"></label>
      </div></fieldset>

      <fieldset><legend>Attacks</legend>
        <div class="hunt-table hunt-attacks"><span>Name</span><span>Skill</span><span>Power</span><span>Range</span><span>Shape</span><span>Conditions on hit</span>
        ${Array.from({ length: ROWS_ATTACKS }, (_, i) => `
          <input type="text" name="att_name_${i}" value="${esc(att(i).name ?? "")}">
          <select name="att_skill_${i}">${["Fight", "Shoot", "Throw"].map(s => `<option ${s === (att(i).skill ?? "Fight") ? "selected" : ""}>${s}</option>`).join("")}</select>
          <input type="number" name="att_power_${i}" value="${att(i).power ?? ""}" step="1">
          <select name="att_range_${i}">${[["Close"], ["Close", "Medium"], ["Medium", "Close"], ["Medium", "Long"]].map(r => `<option value="${r.join(",")}" ${(att(i).range ?? ["Close"]).join(",") === r.join(",") ? "selected" : ""}>${r.join(" + ")}</option>`).join("")}</select>
          <select name="att_shape_${i}">${["single", "area", "cone"].map(sh => `<option value="${sh}" ${sh === (att(i).shape ?? "single") ? "selected" : ""}>${sh}</option>`).join("")}</select>
          <input type="text" name="att_cond_${i}" value="${esc((att(i).conditions ?? []).join(", "))}" placeholder="Bleeding">`).join("")}
        </div>
      </fieldset>

      <fieldset><legend>Abilities</legend>
        <div class="hunt-table hunt-abilities"><span>Name</span><span>Effect</span>
        ${Array.from({ length: ROWS_ABILITIES }, (_, i) => `
          <input type="text" name="abl_name_${i}" value="${esc(abl(i).name ?? "")}">
          <input type="text" name="abl_text_${i}" value="${esc(abl(i).text ?? "")}">`).join("")}
        </div>
      </fieldset>

      <fieldset class="hunt-phases" ${cat === "boss" ? "" : "hidden"}><legend>Boss phases</legend>
        <div class="hunt-table hunt-phase-table"><span>Phase</span><span>Attack</span><span>Defence</span><span>Note</span>
        ${phases.map((p, i) => `
          <input type="text" name="ph_name_${i}" value="${esc(p.name)}">
          <input type="number" name="ph_att_${i}" value="${p.attack}" step="1">
          <input type="number" name="ph_def_${i}" value="${p.defence}" step="1">
          <input type="text" name="ph_note_${i}" value="${esc(p.note)}">`).join("")}
        </div>
      </fieldset>
    </div>`;
}

function readCreator(form) {
    const f = form.elements;
    const list = v => v.split(",").map(x => x.trim()).filter(Boolean);
    const skills = {};
    for (const n of MONSTER_SKILLS) if (f[`skill_${n}`].value !== "") skills[n] = Number(f[`skill_${n}`].value);
    const attacks = [];
    for (let i = 0; i < ROWS_ATTACKS; i++) {
        const name = f[`att_name_${i}`].value.trim();
        if (!name) continue;
        attacks.push({ name, skill: f[`att_skill_${i}`].value, power: Number(f[`att_power_${i}`].value || 0),
            range: f[`att_range_${i}`].value.split(","), shape: f[`att_shape_${i}`].value, conditions: list(f[`att_cond_${i}`].value) });
    }
    const abilities = [];
    for (let i = 0; i < ROWS_ABILITIES; i++) {
        const name = f[`abl_name_${i}`].value.trim();
        if (name) abilities.push({ name, text: f[`abl_text_${i}`].value.trim() });
    }
    const phases = [];
    for (let i = 0; f[`ph_name_${i}`]; i++) {
        const name = f[`ph_name_${i}`].value.trim();
        if (name) phases.push({ name, attack: Number(f[`ph_att_${i}`].value || 0), defence: Number(f[`ph_def_${i}`].value || 0), note: f[`ph_note_${i}`].value.trim() });
    }
    return {
        name: f.name.value.trim(), category: f.category.value, aspect: f.aspect.value.trim(),
        description: f.description.value.trim(), img: f.img.value.trim(), skills,
        health: Number(f.health.value || 1), armor: Number(f.armor.value || 0), dread: Number(f.dread.value || 0),
        consequences: f.consequences.checked, vitalKills: f.vitalKills.checked, fireproof: f.fireproof.checked, volatile: f.volatile.checked, vitalPierces: f.vitalPierces.checked, immune: list(f.immune.value),
        attacks, abilities, phases
    };
}

export async function openCreator(preset = null) {
    if (!game.user.isGM) return;
    let specs = [];
    try { specs = await (await fetch(BESTIARY_PATH)).json(); } catch (e) { /* no presets */ }

    // Step 1: start from blank or from a bestiary entry.
    let spec = preset;
    if (!spec) {
        const choice = await foundry.applications.api.DialogV2.prompt({
            window: { title: "Monster Creator" },
            content: `<div class="hunt-dialog"><label>Start from <select name="base"><option value="">Blank</option>
                ${specs.map((s, i) => `<option value="${i}">${esc(s.name)} (${CATEGORIES[s.category]?.label ?? s.category})</option>`).join("")}
              </select></label></div>`,
            ok: { label: "Next", callback: (e, b) => b.form.elements.base.value },
            rejectClose: false
        });
        if (choice === null || choice === undefined) return;
        spec = choice === "" ? { category: "grunt", health: 2, dread: 1, skills: { Fight: 1, Athletics: 0, Notice: 1 } }
            : foundry.utils.deepClone(specs[Number(choice)]);
        if (choice !== "") spec.name = `${spec.name} (variant)`;
    }

    const result = await foundry.applications.api.DialogV2.prompt({
        window: { title: "Monster Creator", resizable: true },
        position: { width: 720 },
        content: creatorContent(spec),
        render: (event, dialog) => {
            const root = dialog.element;
            const cat = root.querySelector('select[name="category"]');
            const ph = root.querySelector(".hunt-phases");
            cat?.addEventListener("change", () => { if (ph) ph.hidden = cat.value !== "boss"; });
        },
        ok: { label: "Create", icon: "fas fa-skull", callback: (e, b) => readCreator(b.form) },
        rejectClose: false
    });
    if (!result) return;
    if (!result.name) return ui.notifications.warn("Give the monster a name.");
    try {
        const folder = await getFolder();
        const actor = await Actor.create(buildMonster(result, folder.id));
        actor?.sheet?.render(true);
    } catch (err) {
        ui.notifications.error(err.message);
        console.error(err);
    }
}

/* ------------------------------------------------------------ sheet banner */

export function decorateMonsterSheet(app, html) {
    const actor = app.document;
    const m = monsterData(actor);
    if (!m) return;
    const root = html instanceof HTMLElement ? html : html[0];
    if (root.querySelector(".hunt-monster-banner")) return;
    const host = root.querySelector(".mfate-sheet") ?? root.querySelector(".window-content") ?? root;

    const phase = m.phases?.[m.phase ?? 0];
    const tags = [
        CATEGORIES[m.category]?.label ?? m.category,
        `Dread ${m.dread}`,
        m.armor ? `Armour ${m.armor}` : "",
        m.vitalKills ? "Vital hit kills" : "",
        m.vitalPierces ? "Vital pierces armour" : "",
        m.category !== "boss" && !m.fireproof && !(m.immune ?? []).includes("Burning") ? "Fire kills" : "",
        m.fireproof ? "Fireproof" : "",
        m.volatile ? (m.ignited ? "ABLAZE" : "Volatile: bullets and blades set it ablaze") : "",
        m.deathBurst ? `${m.deathBurst.label || "Death burst"} when it dies${m.deathBurst.notFire ? " (not if burned)" : ""}` : "",
        m.aura ? `${m.aura.label || "Aura"}: ${m.aura.skill || "Will"} vs ${m.aura.difficulty ?? m.dread} within ${m.aura.radius} m each exchange` : "",
        m.immune?.length ? `Immune: ${m.immune.join(", ")}` : ""
    ].filter(Boolean);

    const banner = document.createElement("div");
    banner.className = "hunt-monster-banner";
    banner.innerHTML = `
      <div class="hunt-monster-tags">${tags.map(t => `<span>${esc(t)}</span>`).join("")}</div>
      ${m.phases?.length ? `<div class="hunt-monster-phase">
        <label>Phase <select ${actor.isOwner ? "" : "disabled"}>${m.phases.map((p, i) => `<option value="${i}" ${i === (m.phase ?? 0) ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
        <span class="hunt-hint">${phase ? `attack ${phase.attack >= 0 ? "+" : ""}${phase.attack}, defence ${phase.defence >= 0 ? "+" : ""}${phase.defence} — ${esc(phase.note)}` : ""}</span>
      </div>` : ""}`;
    const select = banner.querySelector("select");
    select?.addEventListener("change", async ev => {
        ev.stopPropagation();
        const i = Number(ev.target.value);
        await actor.setFlag(MODULE_ID, "monster.phase", i);
        const p = m.phases[i];
        ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            whisper: ChatMessage.getWhisperRecipients("GM"),
            content: `<div class="hunt-card"><div class="hunt-row"><strong>${esc(actor.name)}</strong> enters <strong>${esc(p.name)}</strong>. ${esc(p.note)}</div></div>`
        });
    });
    // Keep the select's change from submitting the Fate sheet form.
    select?.removeAttribute("name");
    host.prepend(banner);
}

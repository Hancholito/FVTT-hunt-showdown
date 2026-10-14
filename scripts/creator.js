/* Hunt: Showdown RPG — Hunter Creator.
 * Step 1: name and archetype (or Custom). Step 2: skill pyramid (the archetype fixes Great and the two Goods),
 * aspects, signature stunt, starting trait. Applies to a new hunter or to an existing one.
 */

const MODULE_ID = "hunt-showdown-fco";
const ARCHETYPES_PATH = `modules/${MODULE_ID}/data/archetypes.json`;
const TRAITS_PATH = `modules/${MODULE_ID}/data/traits.json`;

// Fate Core pyramid on 20 points: one Great (+4), two Good (+3), three Fair (+2), four Average (+1).
const TIERS = [
    { rank: 4, label: "Great (+4)", count: 1 },
    { rank: 3, label: "Good (+3)", count: 2 },
    { rank: 2, label: "Fair (+2)", count: 3 },
    { rank: 1, label: "Average (+1)", count: 4 }
];
const ASPECTS = ["High Concept", "Trouble", "Archetype", "Bloodline"];

function esc(text) {
    return foundry.utils.escapeHTML(String(text ?? ""));
}

function b64(text) {
    return fcoConstants.tob64(text);
}

function worldSkillNames() {
    return Object.values(fcoConstants.wd()?.system?.skills ?? {}).map(s => s.name).sort();
}

function worldStunts() {
    return fcoConstants.wd()?.system?.stunts ?? {};
}

/* The trait hand that should receive the starting trait: the hunter's player, else the current player. */
function handFor(actor) {
    const players = actor
        ? game.users.filter(u => !u.isGM && actor.testUserPermission(u, "OWNER"))
        : [];
    const user = players[0] ?? (!game.user.isGM ? game.user : null);
    if (!user) return null;
    return game.cards.find(c => c.getFlag(MODULE_ID, "role") === "hand" && c.getFlag(MODULE_ID, "user") === user.id) ?? null;
}

/* The trait card if it is still in a deck. */
function availableCard(name) {
    for (const deck of game.cards.filter(c => c.getFlag(MODULE_ID, "role") === "deck")) {
        const card = deck.cards.find(c => c.name === name && !c.drawn);
        if (card) return { deck, card };
    }
    return null;
}

/* ------------------------------------------------------------ entry point */

export async function openHunterCreator(actor = null) {
    if (!fcoConstants.wd()) return ui.notifications.error("Fate Core Official world data not found.");
    if (actor && !actor.isOwner) return ui.notifications.warn(`You don't own ${actor.name}.`);
    if (!actor && !game.user.can("ACTOR_CREATE")) {
        const own = game.user.character;
        if (!own) return ui.notifications.warn("You can't create actors here. Ask the GM to create your hunter and assign it to you, then open the creator from its sheet.");
        actor = own;
    }

    const archetypes = await (await fetch(ARCHETYPES_PATH)).json();
    const traits = await (await fetch(TRAITS_PATH)).json();
    const current = actor?.getFlag(MODULE_ID, "hunter")?.archetype;

    // ---- Step 1: name and archetype
    const step1 = await foundry.applications.api.DialogV2.prompt({
        window: { title: "Hunter Creator — Archetype" },
        position: { width: 560 },
        content: `
          <div class="hunt-dialog hunt-hcreator">
            <label>Name <input type="text" name="name" value="${esc(actor?.name ?? "")}" placeholder="Hunter's name" required></label>
            <div class="hunt-arch-list">
              ${archetypes.map(a => `
                <label class="hunt-arch">
                  <input type="radio" name="archetype" value="${a.id}" ${a.id === (current ?? archetypes[0].id) ? "checked" : ""}>
                  <span><strong>${esc(a.name)}</strong> — ${esc(a.role)}<br>
                  <span class="hunt-hint">${esc(a.great)} +4 · ${a.good.map(esc).join(", ")} +3 · ${esc(a.stunt.replace(/ \(.*\)$/, ""))}</span></span>
                </label>`).join("")}
              <label class="hunt-arch">
                <input type="radio" name="archetype" value="custom" ${current === "custom" ? "checked" : ""}>
                <span><strong>Custom</strong> — build your own hunter: every skill, the signature stunt and a Tier I starting trait are yours to choose.</span>
              </label>
            </div>
            ${actor ? `<p class="hunt-hint">This rebuilds <strong>${esc(actor.name)}</strong>: skills, the four aspects and the signature stunt are replaced.</p>` : ""}
          </div>`,
        ok: { label: "Next", icon: "fas fa-arrow-right", callback: (e, b) => ({ name: b.form.elements.name.value.trim(), archetype: b.form.elements.archetype.value }) },
        rejectClose: false
    });
    if (!step1) return;
    if (!step1.name) return ui.notifications.warn("Give your hunter a name.");
    const arch = archetypes.find(a => a.id === step1.archetype) ?? null;

    // ---- Step 2: skills, aspects, stunt, trait
    const skills = worldSkillNames();
    const locked = arch ? { 4: [arch.great], 3: [...arch.good] } : {};
    const stunts = Object.values(worldStunts());
    const traitChoices = arch
        ? traits.filter(t => arch.traits.includes(t.name))
        : traits.filter(t => t.tier === 1);
    const hand = handFor(actor);
    const aspectsNow = actor?.system?.aspects ?? {};

    const tierRows = TIERS.map(t => {
        const fixed = locked[t.rank] ?? [];
        const selects = Array.from({ length: t.count }, (_, i) => {
            const val = fixed[i];
            if (val) return `<span class="hunt-fixed" data-skill="${esc(val)}">${esc(val)}</span><input type="hidden" name="tier${t.rank}_${i}" value="${esc(val)}">`;
            return `<select name="tier${t.rank}_${i}" class="hunt-skill-pick"><option value="">—</option>${skills.map(s => `<option>${esc(s)}</option>`).join("")}</select>`;
        }).join("");
        return `<div class="hunt-tier"><span class="hunt-tier-label">${t.label}</span><div class="hunt-tier-picks">${selects}</div></div>`;
    }).join("");

    const step2 = await foundry.applications.api.DialogV2.prompt({
        window: { title: `Hunter Creator — ${step1.name} (${arch?.name ?? "Custom"})`, resizable: true },
        position: { width: 720 },
        content: `
          <div class="hunt-dialog hunt-hcreator">
            <fieldset><legend>Skills — the pyramid</legend>
              ${arch ? `<p class="hunt-hint">The ${esc(arch.name)} archetype fixes the Great and Good skills. Pick the rest; each skill once. Unpicked skills stay at Mediocre (+0).</p>`
                     : `<p class="hunt-hint">Pick every rank; each skill once. Unpicked skills stay at Mediocre (+0).</p>`}
              ${tierRows}
              <p class="hunt-dupes hunt-damage" hidden>A skill is picked twice.</p>
            </fieldset>

            <fieldset><legend>Aspects</legend><div class="hunt-grid2">
              ${ASPECTS.map(n => {
                  const existing = Object.values(aspectsNow).find(a => a.name === n)?.value ?? "";
                  const ph = { "High Concept": "Disgraced Pinkerton With a Steady Hand", "Trouble": "Owes the Wrong People in New Orleans",
                      "Archetype": arch ? `${arch.name} Who…` : "What kind of hunter you are", "Bloodline": "Last of the Duchamp Line" }[n];
                  return `<label class="hunt-span2">${n} <input type="text" name="aspect_${b64(n)}" value="${esc(existing)}" placeholder="${esc(ph)}"></label>`;
              }).join("")}
            </div></fieldset>

            <fieldset><legend>Signature stunt</legend>
              ${arch
                ? `<p><strong>${esc(arch.stunt)}</strong> — ${esc((stunts.find(s => s.name === arch.stunt)?.description ?? "").replace(/<[^>]+>/g, ""))}</p>`
                : `<select name="stunt"><option value="">None</option>${stunts.map(s => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join("")}</select>`}
            </fieldset>

            <fieldset><legend>Starting trait</legend>
              ${hand ? `<div class="hunt-trait-list">${traitChoices.map(t => {
                    const free = !!availableCard(t.name);
                    return `<label class="hunt-arch ${free ? "" : "hunt-taken"}"><input type="radio" name="trait" value="${esc(t.name)}" ${free ? "" : "disabled"}>
                      <span><strong>${esc(t.name)}</strong> <span class="hunt-hint">Tier ${t.tier} · ${t.kind}${free ? "" : " · already taken"}</span><br>${esc(t.effect)}</span></label>`;
                  }).join("")}
                  <label class="hunt-arch"><input type="radio" name="trait" value="" checked><span>No starting trait now</span></label></div>`
                : `<p class="hunt-hint">No player trait hand found for this hunter: the GM can deal the starting trait from the decks.</p>`}
            </fieldset>
          </div>`,
        render: (event, dialog) => {
            const root = dialog.element;
            const check = () => {
                const picks = [...root.querySelectorAll('[name^="tier"]')].map(el => el.value).filter(Boolean);
                const dupes = new Set(picks.filter((v, i) => picks.indexOf(v) !== i));
                root.querySelectorAll("select.hunt-skill-pick").forEach(el => el.classList.toggle("hunt-dupe", dupes.has(el.value)));
                root.querySelector(".hunt-dupes").hidden = dupes.size === 0;
                // Grey out skills already used elsewhere.
                root.querySelectorAll("select.hunt-skill-pick").forEach(sel => {
                    for (const o of sel.options) o.disabled = !!o.value && o.value !== sel.value && picks.includes(o.value);
                });
            };
            root.addEventListener("change", check);
            check();
        },
        ok: {
            label: actor ? "Rebuild hunter" : "Create hunter",
            icon: "fas fa-user-check",
            callback: (e, b) => {
                const f = b.form.elements;
                const ranks = {};
                for (const t of TIERS) for (let i = 0; i < t.count; i++) {
                    const v = f[`tier${t.rank}_${i}`]?.value;
                    if (v) ranks[v] = t.rank;
                }
                const picked = TIERS.flatMap(t => Array.from({ length: t.count }, (_, i) => f[`tier${t.rank}_${i}`]?.value).filter(Boolean));
                const aspects = {};
                for (const n of ASPECTS) aspects[n] = f[`aspect_${b64(n)}`]?.value?.trim() ?? "";
                return {
                    ranks, duplicate: new Set(picked).size !== picked.length, aspects,
                    stunt: arch ? arch.stunt : (f.stunt?.value || ""),
                    trait: b.form.querySelector('input[name="trait"]:checked')?.value ?? ""
                };
            }
        },
        rejectClose: false
    });
    if (!step2) return;
    if (step2.duplicate) return ui.notifications.warn("A skill was picked twice: nothing was changed. Open the creator again.");

    try {
        await applyHunter(actor, step1, arch, step2);
    } catch (err) {
        console.error("Hunt: hunter creator", err);
        ui.notifications.error(`Hunter Creator: ${err.message}`);
    }
}

/* ------------------------------------------------------------ apply */

export async function applyHunter(actor, step1, arch, choice) {
    if (!actor) {
        actor = await Actor.create({ name: step1.name, type: "fate-core-official" }, { renderSheet: false });
        if (!actor) throw new Error("the hunter could not be created.");
    }

    // Skills: everything back to Mediocre, then the pyramid.
    const skills = foundry.utils.deepClone(actor.system.skills ?? {});
    for (const [key, sk] of Object.entries(skills)) sk.rank = choice.ranks[sk.name] ?? 0;
    for (const [name, rank] of Object.entries(choice.ranks)) {
        if (!Object.values(skills).some(s => s.name === name)) {
            const def = Object.values(fcoConstants.wd().system.skills).find(s => s.name === name);
            if (def) skills[b64(name)] = { ...foundry.utils.deepClone(def), rank };
        }
    }
    const tracks = actor.setupTracks(foundry.utils.deepClone(skills), foundry.utils.deepClone(actor.system.tracks ?? {}));

    // Aspects.
    const aspects = foundry.utils.deepClone(actor.system.aspects ?? {});
    for (const [name, value] of Object.entries(choice.aspects)) {
        const key = b64(name);
        if (aspects[key]) aspects[key].value = value;
        else aspects[key] = { name, description: "", value, notes: "" };
    }

    // Signature stunt: remove the previous one set by this tool, add the new one.
    const stunts = foundry.utils.deepClone(actor.system.stunts ?? {});
    const previous = actor.getFlag(MODULE_ID, "hunter")?.stunt;
    if (previous && previous !== choice.stunt) delete stunts[b64(previous)];
    if (choice.stunt) {
        const def = Object.values(fcoConstants.wd().system.stunts ?? {}).find(s => s.name === choice.stunt);
        if (def) stunts[b64(choice.stunt)] = foundry.utils.deepClone(def);
    }

    await actor.update({
        name: step1.name,
        "system.skills": _replaceOrSet(skills),
        "system.tracks": _replaceOrSet(tracks),
        "system.aspects": _replaceOrSet(aspects),
        "system.stunts": _replaceOrSet(stunts),
        [`flags.${MODULE_ID}.hunter`]: { archetype: arch?.id ?? "custom", stunt: choice.stunt || null }
    });

    // Starting trait: from the deck into the player's hand.
    let traitText = "";
    if (choice.trait) {
        const hand = handFor(actor);
        const found = availableCard(choice.trait);
        if (hand && found) {
            try {
                await found.deck.pass(hand, [found.card.id], { chatNotification: false });
                traitText = ` Starting trait: <strong>${esc(choice.trait)}</strong>.`;
            } catch (e) {
                console.warn("Hunt: starting trait", e);
                traitText = ` The starting trait ${esc(choice.trait)} couldn't be dealt: ask the GM.`;
            }
        } else {
            traitText = ` The starting trait ${esc(choice.trait)} is no longer in a deck: ask the GM.`;
        }
    }

    const pyramid = TIERS.map(t => `${t.label}: ${Object.entries(choice.ranks).filter(([, r]) => r === t.rank).map(([n]) => esc(n)).join(", ") || "—"}`).join("<br>");
    await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="hunt-card"><header class="hunt-card__head"><img src="${actor.img}" alt=""><div><h3>${esc(actor.name)}</h3>
          <span class="hunt-hint">${esc(arch?.name ?? "Custom")} hunter${choice.stunt ? ` · ${esc(choice.stunt)}` : ""}</span></div></header>
          <div class="hunt-row">${pyramid}</div>${traitText ? `<div class="hunt-row">${traitText}</div>` : ""}</div>`
    });
    actor.sheet.render(true);
}

/* FCO expects whole objects for these maps: replace them so removed keys disappear. */
function _replaceOrSet(obj) {
    return typeof _replace === "function" ? _replace(obj) : obj;
}

/* ------------------------------------------------------------ sheet banner */

export function decorateHunterSheet(app, html) {
    const actor = app.document;
    if (!actor?.isOwner || actor.getFlag(MODULE_ID, "monster") || actor.getFlag(MODULE_ID, "container") || actor.getFlag(MODULE_ID, "beetle") || actor.getFlag(MODULE_ID, "alarm")) return;
    const root = html instanceof HTMLElement ? html : html[0];
    if (root.querySelector(".hunt-hunter-banner")) return;
    const host = root.querySelector(".mfate-sheet") ?? root.querySelector(".window-content") ?? root;
    const archId = actor.getFlag(MODULE_ID, "hunter")?.archetype;
    const names = { scout: "Scout", brute: "Brute", gunslinger: "Gunslinger", medic: "Field Medic", mystic: "Mystic", scavenger: "Scavenger", sapper: "Sapper", custom: "Custom" };
    const bar = document.createElement("div");
    bar.className = "hunt-hunter-banner";
    bar.innerHTML = `<span>${archId ? `Archetype: <strong>${esc(names[archId] ?? archId)}</strong>` : "No archetype yet"}</span>
      <button type="button"><i class="fas fa-user-gear"></i> Hunter Creator</button>`;
    bar.querySelector("button").addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); openHunterCreator(actor); });
    host.prepend(bar);
}

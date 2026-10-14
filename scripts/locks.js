/* Hunt: Showdown RPG — locks, keys and containers.
 * Doors: a door wall can carry flags[hunt-showdown-fco].lock = { id, difficulty } (Wall configuration).
 * Containers: chests, desks, footlockers are actors with flags[hunt-showdown-fco].container =
 *   { label, lockId, difficulty, locked }; their items are the contents. Their token is linked.
 * A key (lore item, kind "key", lockId) opens the door or container with the same lock ID.
 * Without the key: Burglary overcome vs the lock's difficulty (Fair +2 by default).
 * Search (hunter sheet) opens the container in reach; items are taken one by one.
 * Players can't change walls or other actors: the active GM's client does it through the module socket.
 */

import { getLore } from "./lore.js";

const MODULE_ID = "hunt-showdown-fco";
const SOCKET = `module.${MODULE_ID}`;
const REACH = 2.5; // metres
const A = `modules/${MODULE_ID}/assets/lore`;
export const CONTAINER_TYPES = {
    chest: { label: "Chest", img: `${A}/chest.svg` },
    desk: { label: "Desk", img: `${A}/desk.svg` },
    footlocker: { label: "Footlocker", img: `${A}/footlocker.svg` },
    safe: { label: "Safe", img: `${A}/safe.svg` }
};

function esc(text) {
    return foundry.utils.escapeHTML(String(text ?? ""));
}

const send = req => game.user.isGM ? handle(req) : game.socket.emit(SOCKET, req);

export function containerData(actor) {
    return actor?.getFlag?.(MODULE_ID, "container") ?? null;
}

function metres(px) {
    const grid = canvas.scene.grid;
    const feet = /^(ft|feet|foot|pi|pied|pieds|')\.?$/i.test(String(grid.units ?? "").trim());
    const u = px / grid.size * grid.distance;
    return feet ? u / 3.28084 : u;
}

function hunterToken(actor) {
    return actor.getActiveTokens(true)[0] ?? null;
}

/* Containers in reach: the targeted one first, then the nearest. */
function containersInReach(tok) {
    const near = canvas.tokens.placeables.filter(t => containerData(t.actor) && metres(Math.hypot(t.center.x - tok.center.x, t.center.y - tok.center.y)) - (t.w / canvas.grid.size) / 2 <= REACH);
    const targeted = near.filter(t => game.user.targets.has(t));
    return [...targeted, ...near.filter(t => !targeted.includes(t)).sort((a, b) => Math.hypot(a.center.x - tok.center.x, a.center.y - tok.center.y) - Math.hypot(b.center.x - tok.center.x, b.center.y - tok.center.y))];
}

/* Locked doors with a Hunt lock in reach of the token (distance to the door segment). */
function lockedDoorsInReach(tok) {
    const p = tok.center;
    const out = [];
    for (const w of canvas.walls.placeables) {
        const d = w.document;
        if (!d.door || d.ds !== CONST.WALL_DOOR_STATES.LOCKED) continue;
        const [x1, y1, x2, y2] = d.c;
        const dx = x2 - x1, dy = y2 - y1;
        const t = Math.max(0, Math.min(1, ((p.x - x1) * dx + (p.y - y1) * dy) / (dx * dx + dy * dy || 1)));
        const dist = metres(Math.hypot(p.x - (x1 + t * dx), p.y - (y1 + t * dy)));
        if (dist <= REACH) out.push({ wall: d, dist, lock: d.getFlag(MODULE_ID, "lock") ?? {} });
    }
    return out.sort((a, b) => a.dist - b.dist);
}

function keysOf(actor) {
    return actor.items.filter(i => getLore(i)?.kind === "key" && getLore(i).lockId);
}

async function pickLock(actor, label, difficulty) {
    const skill = Object.values(actor.system.skills ?? {}).find(s => s.name === "Burglary")?.rank ?? 0;
    const roll = await new Roll("4dF").evaluate();
    roll.dice[0].options.sfx = { id: "fate4df", result: roll.result };
    const total = roll.total + skill;
    const ok = total >= difficulty;
    await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }), rolls: [roll],
        content: `<div class="hunt-card"><div class="hunt-row"><strong>${esc(actor.name)}</strong> picks the lock of <strong>${esc(label)}</strong>: Burglary ${total} vs ${difficulty}</div>
          <div class="hunt-result">${ok ? `<span class="hunt-hit">Open</span>` : `<span class="hunt-miss">Still locked</span> — and it made noise.`}</div></div>`
    });
    return ok;
}

/* Asks how to deal with a lock: a matching key, picking it, or nothing. Returns true when it opens. */
async function tryLock(actor, label, lock) {
    const lockId = lock.id ?? lock.lockId;
    const difficulty = Number(lock.difficulty ?? 2);
    const key = lockId ? keysOf(actor).find(k => getLore(k).lockId === lockId) : null;
    const choice = await foundry.applications.api.DialogV2.wait({
        window: { title: `Locked — ${label}` },
        content: `<p><strong>${esc(label)}</strong> is locked.</p>`,
        buttons: [
            ...(key ? [{ action: "key", label: `Use ${key.name}`, icon: "fas fa-key", default: true }] : []),
            { action: "pick", label: `Pick the lock (Burglary vs ${difficulty})`, icon: "fas fa-screwdriver" },
            { action: "leave", label: "Leave it" }
        ],
        rejectClose: false
    });
    if (choice === "key") {
        await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<div class="hunt-card"><div class="hunt-row"><strong>${esc(actor.name)}</strong> opens <strong>${esc(label)}</strong> with ${esc(key.name)}.</div></div>` });
        return true;
    }
    if (choice === "pick") return pickLock(actor, label, difficulty);
    return false;
}

/* ------------------------------------------------------------ search (hunter sheet) */

export async function searchNearby(actor) {
    if (!canvas?.ready) return;
    const tok = hunterToken(actor);
    if (!tok) return ui.notifications.warn(`${actor.name} has no token on this scene.`);
    if (!game.users.activeGM) return ui.notifications.warn("A GM must be connected.");
    const container = containersInReach(tok)[0];
    if (container) return openContainer(actor, container);
    const door = lockedDoorsInReach(tok)[0];
    if (door) {
        if (await tryLock(actor, "the door", door.lock)) send({ action: "unlockDoor", sceneId: canvas.scene.id, wallId: door.wall.id });
        return;
    }
    ui.notifications.info(`Nothing to search within ${REACH} m. Move next to a chest, a desk or a locked door.`);
}

/* The key's own button: the matching door or container in reach. */
export async function useKey(actor, item) {
    if (!game.users.activeGM) return ui.notifications.warn("A GM must be connected.");
    const lore = getLore(item);
    const tok = hunterToken(actor);
    if (!tok) return ui.notifications.warn(`${actor.name} has no token on this scene.`);
    if (!lore?.lockId) return ui.notifications.info(`${item.name} doesn't fit anything here.`);
    const cont = containersInReach(tok).find(t => containerData(t.actor).lockId === lore.lockId);
    if (cont) {
        const c = containerData(cont.actor);
        if (c.locked) {
            send({ action: "unlockContainer", actorId: cont.actor.id });
            await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<div class="hunt-card"><div class="hunt-row"><strong>${esc(actor.name)}</strong> opens <strong>${esc(cont.name)}</strong> with ${esc(item.name)}.</div></div>` });
        }
        return openContainer(actor, cont, true);
    }
    const door = lockedDoorsInReach(tok).find(d => d.lock.id === lore.lockId);
    if (door) {
        send({ action: "unlockDoor", sceneId: canvas.scene.id, wallId: door.wall.id });
        return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<div class="hunt-card"><div class="hunt-row"><strong>${esc(actor.name)}</strong> unlocks the door with ${esc(item.name)}.</div></div>` });
    }
    ui.notifications.info(`${item.name} doesn't fit any lock within ${REACH} m.`);
}

async function openContainer(actor, tok, alreadyOpen = false) {
    const cont = tok.actor;
    const c = containerData(cont);
    if (c.locked && !alreadyOpen) {
        if (!(await tryLock(actor, tok.name, c))) return;
        send({ action: "unlockContainer", actorId: cont.id });
    }
    const render = () => {
        const items = game.actors.get(cont.id)?.items.contents ?? [];
        return `<div class="hunt-loot">${items.length ? items.map(i => `
            <div class="hunt-loot-row"><img src="${esc(i.img)}" alt=""><span>${esc(i.name)}</span>
              <button type="button" data-take="${i.id}"><i class="fas fa-hand"></i> Take</button></div>`).join("")
            : `<p class="hunt-hint">Empty.</p>`}</div>`;
    };
    const dlg = new foundry.applications.api.DialogV2({
        window: { title: `${tok.name}`, icon: "fas fa-box-open" },
        content: render(),
        buttons: [{ action: "all", label: "Take everything", icon: "fas fa-hands" }, { action: "close", label: "Close", default: true }],
        submit: async (result) => {
            if (result !== "all") return;
            for (const i of game.actors.get(cont.id)?.items ?? []) send({ action: "take", containerId: cont.id, itemId: i.id, hunterUuid: actor.uuid, userId: game.user.id });
        },
        rejectClose: false
    });
    await dlg.render({ force: true });
    dlg.element.addEventListener("click", ev => {
        const b = ev.target.closest("[data-take]");
        if (!b) return;
        ev.preventDefault();
        b.disabled = true;
        b.closest(".hunt-loot-row").classList.add("is-taken");
        send({ action: "take", containerId: cont.id, itemId: b.dataset.take, hunterUuid: actor.uuid, userId: game.user.id });
    });
}

/* ------------------------------------------------------------ GM side */

async function handle(req) {
    if (!game.user.isGM) return;
    if (req.action === "unlockDoor") {
        const wall = game.scenes.get(req.sceneId)?.walls.get(req.wallId);
        if (wall) await wall.update({ ds: CONST.WALL_DOOR_STATES.CLOSED });
    }
    if (req.action === "unlockContainer") {
        const a = game.actors.get(req.actorId);
        if (a) await a.setFlag(MODULE_ID, "container.locked", false);
    }
    if (req.action === "take") {
        const cont = game.actors.get(req.containerId);
        const item = cont?.items.get(req.itemId);
        const hunter = await fromUuid(req.hunterUuid);
        if (!item || !hunter) return;
        const data = item.toObject(); delete data._id;
        await hunter.createEmbeddedDocuments("Item", [data]);
        await item.delete();
        await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: hunter }), content: `<div class="hunt-card"><div class="hunt-row"><strong>${esc(hunter.name)}</strong> takes <strong>${esc(item.name)}</strong> from ${esc(cont.name)}.</div></div>` });
    }
}

/* ------------------------------------------------------------ container creator (GM) */

export function containerActorData(type, name, { lockId = "", difficulty = 2, locked = false } = {}) {
    const t = CONTAINER_TYPES[type] ?? CONTAINER_TYPES.chest;
    return {
        name: name || t.label, type: "fate-core-official", img: t.img,
        ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED },
        flags: { [MODULE_ID]: { container: { type, label: t.label, lockId, difficulty: Number(difficulty) || 2, locked: !!locked } } },
        prototypeToken: { name: name || t.label, actorLink: true, width: 1, height: 1, texture: { src: t.img },
            disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL, displayName: CONST.TOKEN_DISPLAY_MODES.HOVER, sight: { enabled: false } }
    };
}

export async function openContainerCreator(actor = null) {
    if (!game.user.isGM) return;
    const c = containerData(actor) ?? { type: "chest", lockId: "", difficulty: 2, locked: false };
    const res = await foundry.applications.api.DialogV2.prompt({
        window: { title: actor ? `Container — ${actor.name}` : "New container" },
        content: `<div class="hunt-dialog hunt-config">
            <label>Name <input type="text" name="name" value="${esc(actor?.name ?? "")}" placeholder="Doyle's footlocker"></label>
            <label>Type <select name="type">${Object.entries(CONTAINER_TYPES).map(([k, v]) => `<option value="${k}" ${k === c.type ? "selected" : ""}>${v.label}</option>`).join("")}</select></label>
            <label>Locked <input type="checkbox" name="locked" ${c.locked ? "checked" : ""}></label>
            <label>Lock ID <input type="text" name="lockId" value="${esc(c.lockId ?? "")}" placeholder="the key's lock ID"></label>
            <label>Pick difficulty <input type="number" name="difficulty" value="${c.difficulty ?? 2}" step="1"> <span class="hunt-hint">Burglary, Fair +2 by default</span></label>
            <p class="hunt-hint">Drag lore items and loot onto the container's sheet to fill it, then drag the container onto the map.</p></div>`,
        ok: { label: "Save", icon: "fas fa-save", callback: (e, b) => { const f = b.form.elements; return { name: f.name.value.trim(), type: f.type.value, locked: f.locked.checked, lockId: f.lockId.value.trim(), difficulty: Number(f.difficulty.value || 2) }; } },
        rejectClose: false
    });
    if (!res) return;
    if (actor) return actor.update({ name: res.name || actor.name, img: CONTAINER_TYPES[res.type].img, [`flags.${MODULE_ID}.container`]: { ...c, ...res, label: CONTAINER_TYPES[res.type].label } });
    let folder = game.folders.find(f => f.type === "Actor" && f.name === "Hunt Containers");
    if (!folder) folder = await Folder.create({ name: "Hunt Containers", type: "Actor", color: "#6b5a2a" });
    const created = await Actor.create({ ...containerActorData(res.type, res.name, res), folder: folder.id });
    created.sheet.render(true);
}

/* ------------------------------------------------------------ hooks */

export function registerLockHooks() {
    Hooks.once("ready", () => {
        game.socket.on(SOCKET, req => {
            if (["unlockDoor", "unlockContainer", "take"].includes(req?.action) && game.users.activeGM?.id === game.user.id) handle(req).catch(e => console.error("Hunt lock:", e));
        });
    });
    // Lock fields in the Wall configuration of doors.
    Hooks.on("renderWallConfig", (app, html) => {
        const root = html instanceof HTMLElement ? html : html[0];
        if (root.querySelector(".hunt-lock-fields")) return;
        const doc = app.document;
        const lock = doc.getFlag(MODULE_ID, "lock") ?? {};
        const fs = document.createElement("fieldset");
        fs.className = "hunt-lock-fields";
        fs.innerHTML = `<legend>Hunt lock</legend>
          <div class="form-group"><label>Lock ID</label><div class="form-fields"><input type="text" name="flags.${MODULE_ID}.lock.id" value="${esc(lock.id ?? "")}" placeholder="opened by keys with this ID"></div></div>
          <div class="form-group"><label>Pick difficulty</label><div class="form-fields"><input type="number" name="flags.${MODULE_ID}.lock.difficulty" value="${lock.difficulty ?? 2}" step="1"></div></div>
          <p class="hint">Set the door state to Locked. A hunter with the matching key, or a Burglary roll, opens it.</p>`;
        const footer = root.querySelector("footer, .form-footer, button[type='submit']")?.closest("footer") ?? root.querySelector("form")?.lastElementChild;
        (footer?.parentElement ?? root.querySelector("form") ?? root).insertBefore(fs, footer ?? null);
        app.setPosition?.({ height: "auto" });
    });
    // Container banner on its sheet (GM: settings).
    Hooks.on("renderfcoCharacter", (app, html) => {
        const c = containerData(app.document);
        if (!c) return;
        const root = html instanceof HTMLElement ? html : html[0];
        if (root.querySelector(".hunt-container-banner")) return;
        const host = root.querySelector(".mfate-sheet") ?? root.querySelector(".window-content") ?? root;
        const div = document.createElement("div");
        div.className = "hunt-monster-banner hunt-container-banner";
        div.innerHTML = `<div class="hunt-monster-tags"><span>${esc(c.label)}</span><span>${c.locked ? `Locked${c.lockId ? ` (${esc(c.lockId)})` : ""} · pick ${c.difficulty}` : "Unlocked"}</span><span>${app.document.items.size} item(s): drag loot and lore onto the Arsenal panel</span></div>`;
        if (game.user.isGM) {
            const b = document.createElement("button");
            b.type = "button"; b.className = "hunt-btn fu_button fas fa-gear"; b.title = "Container settings";
            b.addEventListener("click", () => openContainerCreator(app.document));
            div.append(b);
        }
        host.prepend(div);
    });
}

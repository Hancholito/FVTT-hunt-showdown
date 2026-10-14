/* Hunt: Showdown RPG — beetles.
 * A Stalker or Choke Beetle is played as a token: Use places it on the map (up to 40 m from the hunter),
 * owned by the player, with its own vision (it sees through the fog of war). The player moves it to guide it.
 * It lives 3 exchanges, or until the player:
 *   - bursts the Stalker: every targeted token within its sight is Spotted (eye icon, free invoke),
 *   - releases the Choke: choking smoke where it stands (Blinded, Choking Smoke),
 *   - recalls it.
 * Players can't create tokens or actors, so the active GM's client does it through the module socket.
 */

import { pickPoint, radiusPixels, flashBlast, tokensInBlast, resolveMulti } from "./explosives.js";

const MODULE_ID = "hunt-showdown-fco";
const SOCKET = `module.${MODULE_ID}`;
const RANGE = 40;           // metres from the hunter
const LIFE = 3;             // exchanges
const SIGHT = { stalker: 15, choke: 8 };
const NAMES = { stalker: "Stalker Beetle", choke: "Choke Beetle" };
const IMG = `modules/${MODULE_ID}/assets/beetle.svg`;

function esc(text) {
    return foundry.utils.escapeHTML(String(text ?? ""));
}

function metresBetween(a, b) {
    const grid = canvas.scene.grid;
    const feet = /^(ft|feet|foot|pi|pied|pieds|')\.?$/i.test(String(grid.units ?? "").trim());
    const units = Math.hypot(a.x - b.x, a.y - b.y) / grid.size * grid.distance;
    return feet ? units / 3.28084 : units;
}

export function beetleData(actor) {
    return actor?.getFlag(MODULE_ID, "beetle") ?? null;
}

/* ------------------------------------------------------------ deploy (any client) */

export async function deployBeetle(actor, item, kind) {
    if (!canvas?.ready || !canvas.scene) { ui.notifications.warn("Open the scene first."); return false; }
    if (!game.users.activeGM) { ui.notifications.warn("A GM must be connected to release a beetle."); return false; }
    const hunterToken = actor.getActiveTokens(true)[0] ?? canvas.tokens.controlled[0] ?? null;
    if (!hunterToken) { ui.notifications.warn(`${actor.name} has no token on this scene.`); return false; }
    const point = await pickPoint(`${NAMES[kind]} (up to ${RANGE} m)`);
    if (!point) return false;
    const dist = metresBetween(hunterToken.center, point);
    if (dist > RANGE) { ui.notifications.warn(`Too far: ${Math.round(dist)} m (max ${RANGE} m).`); return false; }
    const size = canvas.scene.grid.size / 2;
    const request = { action: "spawn", kind, userId: game.user.id, ownerName: actor.name, ownerUuid: actor.uuid,
        sceneId: canvas.scene.id, x: Math.round(point.x - size / 2), y: Math.round(point.y - size / 2) };
    if (game.user.isGM) await handle(request); else game.socket.emit(SOCKET, request);
    const buttons = kind === "stalker"
        ? `<button type="button" class="hunt-beetle-btn" data-act="burst"><i class="fas fa-eye"></i> Burst — mark targeted hunters</button>`
        : `<button type="button" class="hunt-beetle-btn" data-act="release"><i class="fas fa-smog"></i> Release the smoke</button>`;
    await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        whisper: kind === "stalker" ? [game.user.id, ...game.users.filter(u => u.isGM).map(u => u.id)] : [],
        content: `<div class="hunt-card">
          <header class="hunt-card__head"><img src="${IMG}" alt=""><div><h3>${NAMES[kind]}</h3>
            <span class="hunt-hint">${esc(actor.name)} · ${LIFE} exchanges · sight ${SIGHT[kind]} m</span></div></header>
          <div class="hunt-row">The beetle is on the map: move its token to guide it (Lore overcome vs Fair +2 to slip past watchful hunters). You see what it sees.</div>
          ${buttons}
          <button type="button" class="hunt-beetle-btn" data-act="recall"><i class="fas fa-rotate-left"></i> Recall</button>
        </div>`,
        flags: { [MODULE_ID]: { beetle: { kind, userId: game.user.id, ownerName: actor.name } } }
    });
    return true;
}

/* The beetle token this user released last on this scene. */
function findBeetleToken(userId, kind) {
    return canvas.tokens.placeables.filter(t => {
        const b = beetleData(t.actor);
        return b && b.userId === userId && b.kind === kind;
    }).at(-1) ?? null;
}

async function onButton(message, act) {
    const info = message.getFlag(MODULE_ID, "beetle");
    if (!info) return;
    if (info.userId !== game.user.id && !game.user.isGM) return ui.notifications.warn("Only the beetle's owner can do that.");
    const tok = findBeetleToken(info.userId, info.kind);
    if (!tok) return ui.notifications.warn("That beetle is gone.");
    const remove = { action: "remove", actorId: tok.actor.id, sceneId: canvas.scene.id };
    const send = req => game.user.isGM ? handle(req) : game.socket.emit(SOCKET, req);

    if (act === "recall") {
        await send(remove);
        return ChatMessage.create({ content: `<div class="hunt-card"><div class="hunt-row">${esc(info.ownerName)} recalls the ${NAMES[info.kind]}.</div></div>`, whisper: [game.user.id] });
    }
    if (act === "burst") {
        const px = radiusPixels(SIGHT.stalker);
        const marked = [...game.user.targets].filter(t => t !== tok && Math.hypot(t.center.x - tok.center.x, t.center.y - tok.center.y) <= px);
        if (!marked.length) return ui.notifications.warn(`Target the hunters the beetle can see (within ${SIGHT.stalker} m) first.`);
        await send({ action: "mark", tokenUuids: marked.map(t => t.document.uuid) });
        await send(remove);
        return ChatMessage.create({
            speaker: { alias: info.ownerName },
            content: `<div class="hunt-card"><header class="hunt-card__head"><img src="${IMG}" alt=""><div><h3>Stalker Beetle bursts</h3></div></header>
              <div class="hunt-row"><strong>Spotted</strong>: ${marked.map(t => esc(t.name)).join(", ")} — one free invoke for ${esc(info.ownerName)}'s team on each.</div></div>`
        });
    }
    if (act === "release") {
        const center = tok.center;
        const px = radiusPixels(5);
        flashBlast(center, px, false);
        const caught = tokensInBlast(center, px).filter(t => t !== tok);
        await send(remove);
        return resolveMulti({
            actor: null, targets: caught, title: "Choke Beetle — Smoke", img: IMG,
            attackValue: 2, power: 0, conditions: ["Blinded"], zoneAspect: "Choking Smoke (−2 to all rolls, no Dark Sight)",
            missLabel: "Out of the smoke", headerRows: `<div class="hunt-row hunt-hint">${esc(info.ownerName)}'s beetle bursts into choking smoke (5 m). Fires in the zone go out.</div>`
        });
    }
}

/* ------------------------------------------------------------ GM side */

async function beetleFolder() {
    return game.folders.find(f => f.type === "Actor" && f.name === "Hunt Beetles")
        ?? Folder.create({ name: "Hunt Beetles", type: "Actor", color: "#2f4a3a" });
}

async function handle(req) {
    if (!game.user.isGM) return;
    const scene = game.scenes.get(req.sceneId);
    if (req.action === "spawn") {
        const folder = await beetleFolder();
        const name = `${NAMES[req.kind]} — ${req.ownerName}`;
        const actor = await Actor.create({
            name, type: "fate-core-official", img: IMG, folder: folder.id,
            ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED, [req.userId]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
            flags: { [MODULE_ID]: { beetle: { kind: req.kind, userId: req.userId, ownerUuid: req.ownerUuid, life: LIFE } } },
            prototypeToken: {
                name, actorLink: true, width: 0.5, height: 0.5, texture: { src: IMG },
                disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY, displayName: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
                sight: { enabled: true, range: SIGHT[req.kind], visionMode: "basic" }
            }
        });
        const td = await actor.getTokenDocument({ x: req.x, y: req.y });
        await scene.createEmbeddedDocuments("Token", [td.toObject()]);
    }
    if (req.action === "remove") await removeBeetle(game.actors.get(req.actorId));
    if (req.action === "mark") {
        for (const uuid of req.tokenUuids ?? []) {
            const doc = await fromUuid(uuid);
            try { await doc?.actor?.toggleStatusEffect("eye", { active: true }); } catch (e) { console.warn("Hunt: Spotted", e); }
        }
    }
}

export async function removeBeetle(actor) {
    if (!actor || !beetleData(actor)) return;
    for (const scene of game.scenes) {
        const ids = scene.tokens.filter(t => t.actorId === actor.id).map(t => t.id);
        if (ids.length) await scene.deleteEmbeddedDocuments("Token", ids);
    }
    await actor.delete();
}

/* End of exchange (GM): each beetle loses one exchange of life. Returns the chat rows. */
export async function ageBeetles() {
    const rows = [];
    for (const actor of game.actors.filter(a => beetleData(a))) {
        const life = Number(beetleData(actor).life ?? LIFE) - 1;
        if (life <= 0) {
            rows.push(`<div class="hunt-row"><strong>${esc(actor.name)}</strong> dies.</div>`);
            await removeBeetle(actor);
        } else {
            await actor.setFlag(MODULE_ID, "beetle.life", life);
            rows.push(`<div class="hunt-row"><strong>${esc(actor.name)}</strong> — ${life} exchange${life === 1 ? "" : "s"} left.</div>`);
        }
    }
    return rows;
}

export function registerBeetleHooks() {
    Hooks.once("ready", () => {
        game.socket.on(SOCKET, req => {
            if (game.users.activeGM?.id === game.user.id) handle(req).catch(e => console.error("Hunt beetle:", e));
        });
    });
    Hooks.on("renderChatMessageHTML", (message, html) => {
        for (const b of html.querySelectorAll?.(".hunt-beetle-btn") ?? []) {
            b.addEventListener("click", ev => { ev.preventDefault(); onButton(message, b.dataset.act); });
        }
    });
}

/* Hunt: Showdown RPG — animal alarms.
 * Crows, chickens, dogs, ducks, horses and cows are actors on the map with flags[hunt-showdown-fco].alarm =
 *   { type, label, radius, difficulty, reach, once, spent }
 * When a player moves a hunter within the alarm's radius, they choose: crouch past (Stealth vs difficulty) or run
 * (it goes off). An alarm going off pings its spot on everyone's map, posts a public chat card, and switches nearby
 * monsters that have a "Triggered" phase into it. "Once" alarms (crows, ducks) fly off and vanish; the others re-arm.
 * Players can't change tokens or monsters: the active GM's client does it through the module socket.
 */

const MODULE_ID = "hunt-showdown-fco";
const SOCKET = `module.${MODULE_ID}`;
const A = `modules/${MODULE_ID}/assets/alarms`;

export const ALARM_TYPES = {
    crows: { label: "Crows", img: `${A}/crows.svg`, radius: 4, difficulty: 2, reach: 40, once: true, text: "A murder of crows bursts from the ground, cawing" },
    chickens: { label: "Chicken coop", img: `${A}/chickens.svg`, radius: 3, difficulty: 2, reach: 30, once: false, text: "The chickens panic and squawk" },
    dogs: { label: "Dog kennel", img: `${A}/dogs.svg`, radius: 6, difficulty: 3, reach: 50, once: false, text: "The dogs bark and throw themselves against the cage" },
    ducks: { label: "Ducks", img: `${A}/ducks.svg`, radius: 5, difficulty: 2, reach: 40, once: true, text: "Ducks take off from the water, quacking" },
    horses: { label: "Horses", img: `${A}/horses.svg`, radius: 3, difficulty: 1, reach: 25, once: false, text: "The horses whinny and kick at their stalls" },
    cows: { label: "Cows", img: `${A}/cows.svg`, radius: 3, difficulty: 1, reach: 20, once: false, text: "The cows low and shift in their pen" }
};

function esc(text) {
    return foundry.utils.escapeHTML(String(text ?? ""));
}

export function alarmData(actor) {
    return actor?.getFlag?.(MODULE_ID, "alarm") ?? null;
}

function metres(px) {
    const grid = canvas.scene.grid;
    const feet = /^(ft|feet|foot|pi|pied|pieds|')\.?$/i.test(String(grid.units ?? "").trim());
    const u = px / grid.size * grid.distance;
    return feet ? u / 3.28084 : u;
}

/* Centre of a token from its stored position: in v14 doc.x follows the movement animation, _source is the destination. */
function centerOf(doc) {
    const s = canvas.scene.grid.size;
    const src = doc._source ?? doc;
    return { x: src.x + (src.width * s) / 2, y: src.y + (src.height * s) / 2 };
}

function isHunter(actor) {
    return actor && actor.type === "fate-core-official"
        && !["monster", "container", "beetle", "alarm"].some(f => actor.getFlag(MODULE_ID, f));
}

const send = req => game.user.isGM ? handle(req) : game.socket.emit(SOCKET, req);
const inside = new Set(); // "tokenId:alarmTokenId" pairs already handled until the hunter leaves the radius

/* ------------------------------------------------------------ the moving player's client */

async function onMove(tokenDoc, changes, options, userId) {
    if (userId !== game.user.id || !("x" in changes || "y" in changes)) return;
    if (!canvas?.ready || tokenDoc.parent?.id !== canvas.scene?.id) return;
    if (!isHunter(tokenDoc.actor) || (!tokenDoc.actor.hasPlayerOwner && !game.user.isGM)) return;
    const pos = centerOf(tokenDoc);
    for (const t of canvas.tokens.placeables) {
        const a = alarmData(t.actor);
        if (!a || a.spent || t.document.hidden) continue;
        const key = `${tokenDoc.id}:${t.id}`;
        const ac = centerOf(t.document);
        const dist = metres(Math.hypot(pos.x - ac.x, pos.y - ac.y));
        if (dist > Number(a.radius ?? 3)) { inside.delete(key); continue; }
        if (inside.has(key)) continue;
        inside.add(key);
        await approach(tokenDoc, t, a);
    }
}

async function approach(tokenDoc, alarmToken, a) {
    const actor = tokenDoc.actor;
    const difficulty = Number(a.difficulty ?? 2);
    const choice = await foundry.applications.api.DialogV2.wait({
        window: { title: `${alarmToken.name}` },
        content: `<p><strong>${esc(tokenDoc.name)}</strong> is close to <strong>${esc(alarmToken.name)}</strong>.</p>
                  <p class="hunt-hint">Crouch past slowly (Stealth vs ${difficulty}), or run and let them go off. Beastface: play the trait card and pass.</p>`,
        buttons: [
            { action: "sneak", label: `Crouch past (Stealth vs ${difficulty})`, icon: "fas fa-person-walking", default: true },
            { action: "run", label: "Run past", icon: "fas fa-person-running" },
            { action: "beastface", label: "Beastface (trait played)", icon: "fas fa-paw" }
        ],
        rejectClose: false
    });
    if (choice === "beastface" || choice === null) {
        if (choice === "beastface") await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id).concat(game.user.id), content: `<div class="hunt-card"><div class="hunt-row">${esc(tokenDoc.name)} slips past ${esc(alarmToken.name)} (Beastface).</div></div>` });
        return;
    }
    if (choice === "sneak") {
        const skill = Object.values(actor.system.skills ?? {}).find(s => s.name === "Stealth")?.rank ?? 0;
        const roll = await new Roll("4dF").evaluate();
        roll.dice[0].options.sfx = { id: "fate4df", result: roll.result };
        const total = roll.total + skill;
        const ok = total >= difficulty;
        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }), rolls: [roll],
            whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id).concat(game.user.id),
            content: `<div class="hunt-card"><div class="hunt-row">${esc(tokenDoc.name)} crouches past ${esc(alarmToken.name)}: Stealth ${total} vs ${difficulty}</div>
              <div class="hunt-result">${ok ? `<span class="hunt-hit">Unnoticed</span>` : `<span class="hunt-miss">They notice</span>`}</div></div>`
        });
        if (ok) return;
    }
    send({ action: "alarm", sceneId: canvas.scene.id, tokenId: alarmToken.id, by: tokenDoc.name });
}

/* ------------------------------------------------------------ GM side */

async function handle(req) {
    if (!game.user.isGM || req.action !== "alarm") return;
    const scene = game.scenes.get(req.sceneId);
    const tok = scene?.tokens.get(req.tokenId);
    const a = alarmData(tok?.actor);
    if (!tok || !a || a.spent) return;
    const type = ALARM_TYPES[a.type] ?? {};
    const s = scene.grid.size;
    const center = { x: tok.x + (tok.width * s) / 2, y: tok.y + (tok.height * s) / 2 };
    const reach = Number(a.reach ?? 30);
    // Monsters within earshot that have a Triggered phase switch to it.
    const woken = [];
    for (const t of scene.tokens) {
        const m = t.actor?.getFlag(MODULE_ID, "monster");
        if (!m?.phases?.length) continue;
        const c = { x: t.x + (t.width * s) / 2, y: t.y + (t.height * s) / 2 };
        if (Math.hypot(c.x - center.x, c.y - center.y) / s * scene.grid.distance > reach) continue;
        const idx = m.phases.findIndex(p => /trigger/i.test(p.name));
        if (idx >= 0 && m.phase !== idx) { await t.actor.setFlag(MODULE_ID, "monster.phase", idx); woken.push(t.name); }
    }
    if (a.once) {
        await tok.actor.setFlag(MODULE_ID, "alarm.spent", true);
        await tok.update({ hidden: true });
    }
    game.socket.emit(SOCKET, { action: "alarmPing", sceneId: scene.id, x: center.x, y: center.y });
    pingHere(scene.id, center);
    if (a.sound) foundry.audio.AudioHelper.play({ src: a.sound, volume: 0.8, autoplay: true, loop: false }, true);
    await ChatMessage.create({
        content: `<div class="hunt-card"><header class="hunt-card__head"><img src="${tok.texture.src}" alt=""><div><h3>${esc(type.label ?? a.label ?? "Alarm")}!</h3>
            <span class="hunt-hint">heard up to ${reach} m</span></div></header>
          <div class="hunt-row">${esc(a.text ?? type.text ?? "The animals give the alarm")}${tok.name && tok.name !== (type.label ?? a.label) ? ` — <strong>${esc(tok.name)}</strong>` : ""}. Everyone within earshot knows someone is there.</div></div>`
    });
    if (woken.length) await ChatMessage.create({
        whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id),
        content: `<div class="hunt-card"><div class="hunt-row">Woken by the noise (phase Triggered): <strong>${woken.map(esc).join(", ")}</strong>${req.by ? ` — set off by ${esc(req.by)}` : ""}.</div></div>`
    });
}

function pingHere(sceneId, point) {
    if (canvas?.scene?.id !== sceneId) return;
    try { canvas.ping(point, { style: "alert", color: "#e0573f", duration: 4000, size: canvas.scene.grid.size * 3 }); }
    catch (e) { try { canvas.ping(point); } catch (e2) { /* no ping */ } }
}

/* ------------------------------------------------------------ creator (GM) */

export function alarmActorData(type, name) {
    const t = ALARM_TYPES[type] ?? ALARM_TYPES.crows;
    return {
        name: name || t.label, type: "fate-core-official", img: t.img,
        ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED },
        flags: { [MODULE_ID]: { alarm: { type, label: t.label, radius: t.radius, difficulty: t.difficulty, reach: t.reach, once: t.once, spent: false, text: t.text, sound: "" } } },
        prototypeToken: { name: name || t.label, actorLink: false, width: 1, height: 1, texture: { src: t.img },
            disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL, displayName: CONST.TOKEN_DISPLAY_MODES.HOVER, sight: { enabled: false } }
    };
}

export async function openAlarmCreator(actor = null) {
    if (!game.user.isGM) return;
    const a = alarmData(actor) ?? { type: "crows", ...ALARM_TYPES.crows };
    const res = await foundry.applications.api.DialogV2.prompt({
        window: { title: actor ? `Alarm — ${actor.name}` : "New animal alarm" },
        content: `<div class="hunt-dialog hunt-config">
            <label>Animals <select name="type">${Object.entries(ALARM_TYPES).map(([k, v]) => `<option value="${k}" ${k === a.type ? "selected" : ""}>${v.label}</option>`).join("")}</select></label>
            <label>Name <input type="text" name="name" value="${esc(actor?.name ?? "")}" placeholder="Crows by the barn"></label>
            <label>Trigger radius (m) <input type="number" name="radius" value="${a.radius}" min="1" step="1"></label>
            <label>Stealth difficulty <input type="number" name="difficulty" value="${a.difficulty}" step="1"></label>
            <label>Heard up to (m) <input type="number" name="reach" value="${a.reach}" min="1" step="1"></label>
            <label>Once (fly off) <input type="checkbox" name="once" ${a.once ? "checked" : ""}></label>
            <label class="hunt-span2">Sound (path, optional) <input type="text" name="sound" value="${esc(a.sound ?? "")}"></label>
            <p class="hunt-hint">Leave a type's defaults for the usual behaviour. Drag the alarm onto the map; tokens of one actor are independent.</p></div>`,
        ok: { label: "Save", icon: "fas fa-save", callback: (e, b) => { const f = b.form.elements; return { type: f.type.value, name: f.name.value.trim(), radius: Number(f.radius.value), difficulty: Number(f.difficulty.value), reach: Number(f.reach.value), once: f.once.checked, sound: f.sound.value.trim() }; } },
        rejectClose: false
    });
    if (!res) return;
    const t = ALARM_TYPES[res.type];
    const flags = { type: res.type, label: t.label, radius: res.radius, difficulty: res.difficulty, reach: res.reach, once: res.once, spent: false, text: t.text, sound: res.sound };
    if (actor) return actor.update({ name: res.name || actor.name, img: t.img, "prototypeToken.texture.src": t.img, [`flags.${MODULE_ID}.alarm`]: flags });
    let folder = game.folders.find(f => f.type === "Actor" && f.name === "Hunt Alarms");
    if (!folder) folder = await Folder.create({ name: "Hunt Alarms", type: "Actor", color: "#4a5a2a" });
    const data = alarmActorData(res.type, res.name);
    data.flags[MODULE_ID].alarm = flags;
    await Actor.create({ ...data, folder: folder.id });
}

/* ------------------------------------------------------------ hooks */

export function registerAlarmHooks() {
    Hooks.once("ready", () => {
        game.socket.on(SOCKET, req => {
            if (req?.action === "alarmPing") return pingHere(req.sceneId, { x: req.x, y: req.y });
            if (req?.action === "alarm" && game.users.activeGM?.id === game.user.id) handle(req).catch(e => console.error("Hunt alarm:", e));
        });
    });
    Hooks.on("updateToken", (doc, changes, options, userId) => { onMove(doc, changes, options, userId).catch(e => console.error("Hunt alarm:", e)); });
    // Alarm banner on its sheet (GM: settings, reset).
    Hooks.on("renderfcoCharacter", (app, html) => {
        const a = alarmData(app.document);
        if (!a) return;
        const root = html instanceof HTMLElement ? html : html[0];
        if (root.querySelector(".hunt-alarm-banner")) return;
        const host = root.querySelector(".mfate-sheet") ?? root.querySelector(".window-content") ?? root;
        const div = document.createElement("div");
        div.className = "hunt-monster-banner hunt-alarm-banner";
        div.innerHTML = `<div class="hunt-monster-tags"><span>${esc(ALARM_TYPES[a.type]?.label ?? "Alarm")}</span><span>radius ${a.radius} m</span><span>Stealth vs ${a.difficulty}</span><span>heard ${a.reach} m</span><span>${a.once ? (a.spent ? "flown off" : "goes off once") : "repeats"}</span></div>`;
        if (game.user.isGM) {
            const b = document.createElement("button");
            b.type = "button"; b.className = "hunt-btn fu_button fas fa-gear"; b.title = "Alarm settings";
            b.addEventListener("click", () => openAlarmCreator(app.document));
            div.append(b);
            if (a.spent) {
                const r = document.createElement("button");
                r.type = "button"; r.className = "hunt-btn fu_button fas fa-rotate-left"; r.title = "Reset (the animals are back)";
                r.addEventListener("click", async () => { await app.document.setFlag(MODULE_ID, "alarm.spent", false); for (const t of app.document.getActiveTokens()) await t.document.update({ hidden: false }); });
                div.append(r);
            }
        }
        host.prepend(div);
    });
}

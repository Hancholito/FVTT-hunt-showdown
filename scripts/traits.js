/* Hunt: Showdown RPG — trait cards.
 * Three decks (Tier I-III), one hand per player (the traits they hold, max 4),
 * a "Played Traits" pile used only to trigger a card, and a discard pile.
 * Playing a card to "Played Traits" posts its effect to chat (and spends a Fate point for
 * active traits), then the card stays in the player's hand: traits are kept, not consumed.
 */

const MODULE_ID = "hunt-showdown-fco";
const TRAITS_PATH = `modules/${MODULE_ID}/data/traits.json`;
const FOLDER = "Hunt Traits";
export const HAND_LIMIT = 4;

const OWNER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
const NONE = CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE;

const TIER_NAMES = { 1: "Traits — Tier I", 2: "Traits — Tier II", 3: "Traits — Tier III" };
const TIER_WHERE = { 1: "found in marked caches", 2: "taken from elite monsters", 3: "won from the Bounty" };

function role(cards) {
    return cards?.getFlag(MODULE_ID, "role");
}

function findByRole(r, extra = () => true) {
    return game.cards.find(c => role(c) === r && extra(c));
}

function esc(text) {
    return foundry.utils.escapeHTML(String(text ?? ""));
}

async function getFolder() {
    return game.folders.find(f => f.type === "Cards" && f.name === FOLDER)
        ?? Folder.create({ name: FOLDER, type: "Cards", color: "#5c4127" });
}

/* Decks and piles. Existing ones are left as they are. Returns how many documents were created. */
export async function createTraitDecks() {
    if (!game.user.isGM) return 0;
    const traits = await (await fetch(TRAITS_PATH)).json();
    const folder = await getFolder();
    const toCreate = [];

    for (const tier of [1, 2, 3]) {
        if (findByRole("deck", c => c.getFlag(MODULE_ID, "tier") === tier)) continue;
        const back = `modules/${MODULE_ID}/assets/cards/back-tier${tier}.svg`;
        toCreate.push({
            name: TIER_NAMES[tier],
            type: "deck",
            img: back,
            folder: folder.id,
            description: `<p>Tier ${tier} traits, ${TIER_WHERE[tier]}.</p>`,
            ownership: { default: OWNER },
            width: 2, height: 3,
            flags: { [MODULE_ID]: { role: "deck", tier } },
            cards: traits.filter(t => t.tier === tier).map((t, i) => ({
                name: t.name,
                type: "base",
                description: `<p>${esc(t.effect)}</p>`,
                suit: `Tier ${tier}`,
                value: t.cost,
                face: 0,
                width: 2, height: 3,
                sort: i,
                back: { name: TIER_NAMES[tier], img: back },
                faces: [{ name: t.name, img: t.img, text: `<p>${esc(t.effect)}</p>` }],
                flags: { [MODULE_ID]: { trait: { cost: t.cost, tier, kind: t.kind, effect: t.effect } } }
            }))
        });
    }
    if (!findByRole("play")) toCreate.push({
        name: "Played Traits", type: "pile", folder: folder.id, img: "icons/svg/card-joker.svg",
        description: "<p>Play a trait here to use it: its effect goes to chat and the card returns to your hand.</p>",
        ownership: { default: OWNER }, flags: { [MODULE_ID]: { role: "play" } }
    });
    if (!findByRole("discard")) toCreate.push({
        name: "Discarded Traits", type: "pile", folder: folder.id, img: "icons/svg/card-joker.svg",
        description: "<p>Traits dropped to make room, or lost.</p>",
        ownership: { default: OWNER }, flags: { [MODULE_ID]: { role: "discard" } }
    });

    if (!toCreate.length) return 0;
    const created = await Cards.createDocuments(toCreate);
    for (const deck of created.filter(c => role(c) === "deck")) await deck.shuffle({ chatNotification: false });
    return created.length;
}

/* One hand per player (non-GM user), owned by that player only. */
export async function createHands() {
    if (!game.user.isGM) return 0;
    const folder = await getFolder();
    const toCreate = [];
    for (const user of game.users.filter(u => !u.isGM)) {
        if (findByRole("hand", c => c.getFlag(MODULE_ID, "user") === user.id)) continue;
        toCreate.push({
            name: `Traits — ${user.name}`, type: "hand", folder: folder.id, img: "icons/svg/card-hand.svg",
            description: `<p>${esc(user.name)}'s traits. Hand limit: ${HAND_LIMIT}.</p>`,
            ownership: { default: NONE, [user.id]: OWNER },
            flags: { [MODULE_ID]: { role: "hand", user: user.id } }
        });
    }
    if (toCreate.length) await Cards.createDocuments(toCreate);
    return toCreate.length;
}

/* ------------------------------------------------------------ playing a trait */

async function announce(card, user) {
    const t = card.flags?.[MODULE_ID]?.trait;
    if (!t) return;
    const actor = user.character;
    let cost = "";
    if (t.kind === "active") {
        const fp = actor?.system?.details?.fatePoints;
        if (!actor || !fp) {
            cost = `<div class="hunt-row hunt-hint">Active trait: spend 1 Fate point (no assigned character found).</div>`;
        } else if (fp.current < 1) {
            ui.notifications.warn(`${card.name}: no Fate point left.`);
            return false;
        } else {
            await actor.update({ "system.details.fatePoints.current": fp.current - 1 });
            cost = `<div class="hunt-row hunt-hint">1 Fate point spent — ${fp.current - 1} left.</div>`;
        }
    }
    const img = card.faces?.[0]?.img ?? "";
    await ChatMessage.create({
        speaker: actor ? ChatMessage.getSpeaker({ actor }) : { alias: user.name },
        content: `<div class="hunt-card hunt-trait">
            <header class="hunt-card__head"><img src="${img}" alt=""><div><h3>${esc(card.name)}</h3>
              <span class="hunt-hint">Tier ${t.tier} trait · ${t.kind === "active" ? "active" : "triggered"}</span></div></header>
            <div class="hunt-result">${esc(t.effect)}</div>${cost}</div>`
    });
    return true;
}

export function registerTraitHooks() {
    // Cards are kept: playing one to "Played Traits" only announces it, so the move is cancelled.
    Hooks.on("passCards", (origin, destination, context) => {
        if (role(destination) === "play") {
            const ids = context.toCreate.map(c => c.name);
            const cards = origin.cards.filter(c => ids.includes(c.name));
            (async () => { for (const c of cards) await announce(c, game.user); })();
            return false;
        }
        if (role(destination) === "hand") {
            const incoming = context.toCreate.length;
            if (destination.cards.size + incoming > HAND_LIMIT) {
                ui.notifications.warn(`${destination.name} would hold more than ${HAND_LIMIT} traits. Discard one first.`);
                return false;
            }
        }
    });
}

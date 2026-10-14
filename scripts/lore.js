/* Hunt: Showdown RPG — lore items.
 * A lore item is a Fate Core Official "Extra" carrying flags[hunt-showdown-fco].lore:
 *   { kind, title, text, image, date, author, caption, back, inscription, audio, pages: [{ title, text }],
 *     sender, recipient, origin, destination, seal, lockId, keyLabel }
 * Kinds: clipping (newspaper), note (handwritten), book, photo, toy, cylinder (wax recording), missive (Pony Express), key.
 * Read opens a period handout; the GM (or the owner) can show it to every player; cylinders play their audio.
 * Lore items use no weapon slot and don't count as tools or consumables.
 */

const MODULE_ID = "hunt-showdown-fco";
const SOCKET = `module.${MODULE_ID}`;
const A = `modules/${MODULE_ID}/assets/lore`;

export const LORE_KINDS = {
    clipping: { label: "Newspaper clipping", img: `${A}/clipping.svg`, fields: ["author", "date", "image", "text"] },
    note: { label: "Handwritten note", img: `${A}/note.svg`, fields: ["author", "date", "text"] },
    book: { label: "Book", img: `${A}/book.svg`, fields: ["author", "date", "text", "pages"] },
    photo: { label: "Photograph", img: `${A}/photo.svg`, fields: ["image", "caption", "back", "date"] },
    toy: { label: "Child's toy", img: `${A}/toy.svg`, fields: ["image", "text", "inscription"] },
    cylinder: { label: "Wax cylinder", img: `${A}/cylinder.svg`, fields: ["author", "date", "text", "audio"] },
    missive: { label: "Pony Express missive", img: `${A}/missive.svg`, fields: ["sender", "recipient", "origin", "destination", "date", "seal", "text"] },
    key: { label: "Key", img: `${A}/key.svg`, fields: ["keyLabel", "inscription", "text", "lockId"] }
};
const FIELD_LABELS = {
    author: "Author / newspaper / recorded by", date: "Date", image: "Image (path)", text: "Text",
    caption: "Caption", back: "Written on the back", inscription: "Inscription", audio: "Audio file (path)",
    pages: "Pages (one per block, separated by a line with ---)", sender: "Sender", recipient: "Recipient",
    origin: "From (station)", destination: "To (station)", seal: "Seal", keyLabel: "Tag", lockId: "Opens lock (lock ID, GM only)"
};

function esc(text) {
    return foundry.utils.escapeHTML(String(text ?? ""));
}
/* Text fields keep simple line breaks; HTML authored by the GM is kept as is. */
function rich(text) {
    const t = String(text ?? "");
    return /<\w/.test(t) ? t : t.split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
}

export function getLore(item) {
    return item?.getFlag?.(MODULE_ID, "lore") ?? null;
}

/* ------------------------------------------------------------ rendering */

export function renderBody(name, lore, { gm = false, page = 0, flipped = false } = {}) {
    const k = lore.kind;
    const title = esc(lore.title || name);
    switch (k) {
        case "clipping": return `
            <div class="hunt-lore hunt-lore--clipping">
              <div class="hl-masthead">${esc(lore.author || "The Stillwater Courier")}</div>
              <div class="hl-dateline">${esc(lore.date || "")}</div>
              <h2 class="hl-headline">${title}</h2>
              ${lore.image ? `<img class="hl-clipimg" src="${esc(lore.image)}" alt="">` : ""}
              <div class="hl-columns">${rich(lore.text)}</div>
            </div>`;
        case "note": return `
            <div class="hunt-lore hunt-lore--note">
              ${lore.date ? `<div class="hl-notedate">${esc(lore.date)}</div>` : ""}
              <div class="hl-hand">${rich(lore.text)}</div>
              ${lore.author ? `<div class="hl-sign">— ${esc(lore.author)}</div>` : ""}
            </div>`;
        case "book": {
            const pages = [{ title: lore.title || name, text: `<div class="hl-cover"><h2>${title}</h2>${lore.author ? `<div class="hl-byline">${esc(lore.author)}</div>` : ""}${lore.date ? `<div class="hl-byline">${esc(lore.date)}</div>` : ""}${rich(lore.text)}</div>` },
                ...(lore.pages ?? []).map(p => ({ title: p.title, text: `${p.title ? `<h3>${esc(p.title)}</h3>` : ""}${rich(p.text)}` }))];
            const i = Math.max(0, Math.min(page, pages.length - 1));
            return `
            <div class="hunt-lore hunt-lore--book" data-page="${i}" data-pages="${pages.length}">
              <div class="hl-page">${pages[i].text}</div>
              <div class="hl-pager"><button type="button" data-lore="prev" ${i === 0 ? "disabled" : ""}>‹</button>
                <span>${i + 1} / ${pages.length}</span>
                <button type="button" data-lore="next" ${i === pages.length - 1 ? "disabled" : ""}>›</button></div>
            </div>`;
        }
        case "photo": return `
            <div class="hunt-lore hunt-lore--photo ${flipped ? "is-flipped" : ""}">
              ${flipped
                ? `<div class="hl-photoback"><div class="hl-hand">${rich(lore.back || "")}</div>${lore.date ? `<div class="hl-notedate">${esc(lore.date)}</div>` : ""}</div>`
                : `<div class="hl-print"><img src="${esc(lore.image || `${A}/photo-family.svg`)}" alt=""><div class="hl-caption">${esc(lore.caption || title)}</div></div>`}
              ${lore.back ? `<button type="button" data-lore="flip">${flipped ? "Turn it back" : "Turn it over"}</button>` : ""}
            </div>`;
        case "toy": return `
            <div class="hunt-lore hunt-lore--toy">
              <img src="${esc(lore.image || `${A}/toy-horse.svg`)}" alt="">
              <h2>${title}</h2>
              <div class="hl-desc">${rich(lore.text)}</div>
              ${lore.inscription ? `<div class="hl-carved">${esc(lore.inscription)}</div>` : ""}
            </div>`;
        case "cylinder": return `
            <div class="hunt-lore hunt-lore--cylinder">
              <div class="hl-label"><div class="hl-label-title">${title}</div>
                <div>${esc(lore.author ? `Recorded by ${lore.author}` : "")}</div><div>${esc(lore.date || "")}</div></div>
              ${lore.audio ? `<div class="hl-play"><button type="button" data-lore="play"><i class="fas fa-play"></i> Listen</button>
                  ${gm ? `<button type="button" data-lore="play-all"><i class="fas fa-volume-high"></i> Play for the table</button>` : ""}</div>` : ""}
              <div class="hl-transcript"><div class="hl-transcript-head">Transcript</div>${rich(lore.text)}</div>
            </div>`;
        case "missive": return flipped ? `
            <div class="hunt-lore hunt-lore--letter">
              ${lore.date ? `<div class="hl-notedate">${esc(lore.origin ? `${lore.origin}, ` : "")}${esc(lore.date)}</div>` : ""}
              <div class="hl-hand">${rich(lore.text)}</div>
              ${lore.sender ? `<div class="hl-sign">— ${esc(lore.sender)}</div>` : ""}
              <button type="button" data-lore="flip">Fold it back</button>
            </div>` : `
            <div class="hunt-lore hunt-lore--missive">
              <div class="hl-stamp">PONY EXPRESS<br><small>${esc(lore.origin || "")}</small></div>
              <div class="hl-to"><small>To</small> ${esc(lore.recipient || "")}<br><small>${esc(lore.destination || "")}</small></div>
              <div class="hl-from"><small>From</small> ${esc(lore.sender || "")}</div>
              ${lore.seal ? `<div class="hl-seal" title="${esc(lore.seal)}">${esc(lore.seal.slice(0, 2).toUpperCase())}</div>` : ""}
              <button type="button" data-lore="flip">Open the letter</button>
            </div>`;
        case "key": return `
            <div class="hunt-lore hunt-lore--key">
              <img src="${A}/key-large.svg" alt="">
              <div class="hl-tag">${esc(lore.keyLabel || title)}</div>
              ${lore.inscription ? `<div class="hl-carved">${esc(lore.inscription)}</div>` : ""}
              <div class="hl-desc">${rich(lore.text)}</div>
              ${gm && lore.lockId ? `<div class="hunt-hint">Opens lock <code>${esc(lore.lockId)}</code> (GM only)</div>` : ""}
            </div>`;
        default: return `<div class="hunt-lore"><h2>${title}</h2>${rich(lore.text)}</div>`;
    }
}

/* ------------------------------------------------------------ reader */

export async function openReader(data) {
    // data: { name, img, lore, ownerName? }
    const gm = game.user.isGM;
    const state = { page: 0, flipped: false };
    const content = () => `<div class="hunt-lore-wrap">${renderBody(data.name, data.lore, { gm, ...state })}
        <div class="hunt-lore-actions">
          <button type="button" data-lore="show"><i class="fas fa-eye"></i> Show to everyone</button>
        </div></div>`;
    const dlg = new foundry.applications.api.DialogV2({
        window: { title: data.name, icon: "fas fa-book-open" },
        position: { width: data.lore.kind === "clipping" || data.lore.kind === "book" ? 620 : 480 },
        classes: ["hunt-lore-dialog"],
        content: content(),
        buttons: [{ action: "close", label: "Close", default: true }],
        rejectClose: false
    });
    const wire = () => {
        const root = dlg.element?.querySelector(".hunt-lore-wrap");
        if (!root) return;
        root.addEventListener("click", ev => {
            const act = ev.target.closest("[data-lore]")?.dataset.lore;
            if (!act) return;
            ev.preventDefault();
            if (act === "prev") state.page--;
            if (act === "next") state.page++;
            if (act === "flip") state.flipped = !state.flipped;
            if (act === "play") return playAudio(data.lore.audio, false);
            if (act === "play-all") return playAudio(data.lore.audio, true);
            if (act === "show") return showToEveryone(data);
            root.outerHTML = content();
            wire();
        });
    };
    await dlg.render({ force: true });
    wire();
    return dlg;
}

export async function readItem(item) {
    const lore = getLore(item);
    if (!lore) return;
    return openReader({ name: item.name, img: item.img, lore: gmView(lore) });
}

/* Players never receive the lock ID. */
function gmView(lore) {
    if (game.user.isGM) return lore;
    const { lockId, ...rest } = lore;
    return rest;
}

export function showToEveryone(data) {
    const lore = { ...data.lore }; delete lore.lockId;
    const payload = { action: "showLore", from: game.user.name, data: { name: data.name, img: data.img, lore } };
    game.socket.emit(SOCKET, payload);
    ui.notifications.info(`${data.name} shown to everyone.`);
}

export async function playAudio(src, broadcast) {
    if (!src) return;
    try {
        await foundry.audio.AudioHelper.play({ src, volume: 0.8, autoplay: true, loop: false }, broadcast);
    } catch (e) { ui.notifications.warn(`Can't play ${src}: ${e.message}`); }
}

/* ------------------------------------------------------------ creator / settings */

function formFor(kind, lore = {}) {
    const fields = LORE_KINDS[kind].fields;
    const input = f => {
        const v = f === "pages" ? (lore.pages ?? []).map(p => `${p.title ? `# ${p.title}\n` : ""}${p.text}`).join("\n---\n") : (lore[f] ?? "");
        if (["text", "back", "pages"].includes(f)) return `<label class="hunt-span2">${FIELD_LABELS[f]}<textarea name="${f}" rows="${f === "pages" ? 8 : 5}">${esc(v)}</textarea></label>`;
        if (f === "image" || f === "audio") return `<label class="hunt-span2">${FIELD_LABELS[f]}<span class="hunt-pick"><input type="text" name="${f}" value="${esc(v)}"><button type="button" data-pick="${f === "audio" ? "audio" : "image"}" data-target="${f}"><i class="fas fa-file-import"></i></button></span></label>`;
        return `<label>${FIELD_LABELS[f]}<input type="text" name="${f}" value="${esc(v)}"></label>`;
    };
    return fields.map(input).join("");
}

function readForm(form, kind) {
    const out = { kind };
    for (const f of LORE_KINDS[kind].fields) {
        const el = form.elements[f];
        if (!el) continue;
        if (f === "pages") {
            out.pages = el.value.split(/\n---\n/).map(b => b.trim()).filter(Boolean).map(b => {
                const m = b.match(/^# (.+)\n([\s\S]*)$/);
                return m ? { title: m[1].trim(), text: m[2].trim() } : { title: "", text: b };
            });
        } else out[f] = el.value.trim();
    }
    return out;
}

function wirePickers(root) {
    root.addEventListener("click", ev => {
        const b = ev.target.closest("[data-pick]");
        if (!b) return;
        ev.preventDefault();
        const input = root.querySelector(`[name="${b.dataset.target}"]`);
        new foundry.applications.apps.FilePicker.implementation({ type: b.dataset.pick, current: input.value, callback: p => { input.value = p; } }).render(true);
    });
}

async function loreDialog(title, kind, lore, name) {
    return foundry.applications.api.DialogV2.prompt({
        window: { title },
        position: { width: 560 },
        content: `<div class="hunt-dialog hunt-config hunt-lore-form">
            <label>Name <input type="text" name="name" value="${esc(name ?? "")}" placeholder="${esc(LORE_KINDS[kind].label)}"></label>
            <label>Title (if different) <input type="text" name="title" value="${esc(lore.title ?? "")}"></label>
            ${formFor(kind, lore)}</div>`,
        render: (event, dialog) => wirePickers(dialog.element),
        ok: { label: "Save", icon: "fas fa-save", callback: (e, b) => ({ name: b.form.elements.name.value.trim(), title: b.form.elements.title.value.trim(), lore: readForm(b.form, kind) }) },
        rejectClose: false
    });
}

export async function openLoreCreator() {
    if (!game.user.isGM) return;
    const kind = await foundry.applications.api.DialogV2.wait({
        window: { title: "Lore Creator" },
        content: `<p>What do the hunters find?</p>`,
        buttons: [...Object.entries(LORE_KINDS).map(([k, v]) => ({ action: k, label: v.label })),
            { action: "container", label: "Container (chest, desk…)" }],
        rejectClose: false
    });
    if (!kind) return;
    if (kind === "container") {
        const { openContainerCreator } = await import("./locks.js");
        return openContainerCreator();
    }
    const res = await loreDialog(`New ${LORE_KINDS[kind].label}`, kind, {}, "");
    if (!res) return;
    let folder = game.folders.find(f => f.type === "Item" && f.name === "Hunt Lore");
    if (!folder) folder = await Folder.create({ name: "Hunt Lore", type: "Item", color: "#6b5a2a" });
    const item = await Item.create({
        name: res.name || LORE_KINDS[kind].label, type: "Extra", img: LORE_KINDS[kind].img, folder: folder.id,
        system: { description: { value: `<p>${esc(LORE_KINDS[kind].label)}.</p>` } },
        flags: { [MODULE_ID]: { lore: { ...res.lore, title: res.title } } }
    });
    readItem(item);
}

export async function configureLore(item) {
    const lore = getLore(item);
    if (!lore) return;
    const res = await loreDialog(`Lore — ${item.name}`, lore.kind, lore, item.name);
    if (!res) return;
    await item.update({ name: res.name || item.name, [`flags.${MODULE_ID}.lore`]: { ...lore, ...res.lore, title: res.title } });
}

export function loreSummary(lore) {
    const k = LORE_KINDS[lore.kind];
    const bits = [k?.label ?? "Lore"];
    if (lore.kind === "key" && lore.keyLabel) bits.push(lore.keyLabel);
    if (lore.kind === "cylinder" && lore.audio) bits.push("with audio");
    if (lore.kind === "book") bits.push(`${(lore.pages?.length ?? 0) + 1} pages`);
    if (lore.date) bits.push(lore.date);
    return bits.join(" · ");
}

export function registerLoreHooks() {
    Hooks.once("ready", () => {
        game.socket.on(SOCKET, req => {
            if (req?.action === "showLore") openReader(req.data);
        });
    });
    // Lore Creator button in the Items directory (GM).
    Hooks.on("renderItemDirectory", (app, html) => {
        if (!game.user.isGM) return;
        const root = html instanceof HTMLElement ? html : html[0];
        const actions = root.querySelector(".header-actions");
        if (!actions || actions.querySelector(".hunt-lore-creator-btn")) return;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "hunt-creator-btn hunt-lore-creator-btn";
        btn.innerHTML = `<i class="fas fa-feather-pointed"></i> Lore Creator`;
        btn.addEventListener("click", () => openLoreCreator());
        actions.append(btn);
    });
}

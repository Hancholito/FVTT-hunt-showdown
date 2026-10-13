/* Hunt: Showdown RPG — sheet layout tweaks on Fate Core Official character sheets.
 * Description and Biography side by side, leaving the height to the Arsenal (Extras) panel.
 */

export function sideBySideBio(app, html) {
    try {
        const root = html instanceof HTMLElement ? html : html[0];
        const tab = root.querySelector(".biography_body");
        if (!tab || tab.querySelector(":scope > .hunt-bio-row")) return;
        const desc = tab.querySelector(":scope > .mfate-description, :scope > .mfate-description-collapsed");
        const bio = tab.querySelector(":scope > .mfate-biography, :scope > .mfate-biography-collapsed");
        if (!desc || !bio) return;
        const row = document.createElement("div");
        row.className = "hunt-bio-row";
        if (desc.classList.contains("mfate-description-collapsed") && bio.classList.contains("mfate-biography-collapsed")) {
            row.classList.add("hunt-bio-row--collapsed");
        }
        desc.before(row);
        row.append(desc, bio);
    } catch (e) {
        console.error("Hunt: sheet layout", e);
    }
}

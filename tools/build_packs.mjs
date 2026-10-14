// Builds the module's compendium packs (packs/*) from the module's own data and code.
// Usage: node tools/build_packs.mjs <path to @foundryvtt/foundryvtt-cli>
// Writes JSON sources to packs-src/_build/<pack>/ and compiles them to LevelDB in packs/<pack>/.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = process.argv[2] ?? "/home/claude/packtool/node_modules/@foundryvtt/foundryvtt-cli/index.mjs";
const MODULE_ID = "hunt-showdown-fco";
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
const setup = read("data/setup.json");
const arsenal = read("data/arsenal.json");
const bestiary = read("data/bestiary.json");
const traits = read("data/traits.json");
const archetypes = read("data/archetypes.json");

// ---------------------------------------------------------------- Foundry stubs for the module's builders
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
globalThis.foundry = { utils: { deepClone: o => structuredClone(o), escapeHTML: esc, mergeObject: (a, b) => ({ ...a, ...b }) } };
globalThis.CONST = { TOKEN_DISPOSITIONS: { HOSTILE: -1 }, DOCUMENT_OWNERSHIP_LEVELS: { NONE: 0, OBSERVER: 2, OWNER: 3 } };
globalThis.fcoConstants = {
    tob64: s => Buffer.from(s, "utf8").toString("base64").replace(/=+$/, ""),
    wd: () => ({ system: { skills: setup.skills, tracks: setup.tracks } })
};
globalThis.Hooks = { on: () => {}, once: () => {} };
globalThis.game = { settings: { get: () => ({}) } };
const { buildMonster } = await import(pathToFileURL(path.join(ROOT, "scripts/monsters.js")));
const { traitDeckData } = await import(pathToFileURL(path.join(ROOT, "scripts/traits.js")));

// ---------------------------------------------------------------- helpers
const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function id(seed) {
    const h = crypto.createHash("sha256").update(`${MODULE_ID}:${seed}`).digest();
    return Array.from(h.subarray(0, 16), b => ALNUM[b % 62]).join("");
}
const STATS = { coreVersion: "14.369", systemId: "fate-core-official", systemVersion: "4.7.14.12" };
const out = {};
function put(pack, doc) { (out[pack] ??= []).push(doc); }
function folder(pack, type, name, color, sort) {
    const fid = id(`${pack}:folder:${name}`);
    put(pack, { _id: fid, _key: `!folders!${fid}`, name, type, color, sorting: "a", sort, folder: null, description: "", flags: {} });
    return fid;
}

// ---------------------------------------------------------------- Arsenal (Items)
const CATS = {
    handgun: ["Handguns", "#5c4127"], longgun: ["Long Guns", "#4f3a22"], grenade: ["Grenades & Bombs", "#6b2f1e"],
    thrown: ["Thrown Weapons", "#5a4a2a"], melee: ["Melee Weapons", "#4a4a3a"], support: ["Support Items", "#2f4a3a"]
};
const catFolder = {};
Object.entries(CATS).forEach(([k, [label, color]], i) => { catFolder[k] = folder("hunt-arsenal", "Item", label, color, (i + 1) * 100000); });
arsenal.forEach((e, i) => {
    const _id = id(`item:${e.name}`);
    const flags = {};
    if (e.weapon) flags.weapon = e.weapon;
    if (e.support) flags.support = e.support;
    put("hunt-arsenal", {
        _id, _key: `!items!${_id}`, name: e.name, type: "Extra", img: e.img, folder: catFolder[e.category], sort: i * 100,
        system: { description: { value: e.description } }, effects: [], ownership: { default: 0 },
        flags: { [MODULE_ID]: flags }, _stats: STATS
    });
});

// ---------------------------------------------------------------- Bestiary (Actors)
const monFolder = {
    grunt: folder("hunt-bestiary", "Actor", "Grunts", "#4a4a3a", 100000),
    elite: folder("hunt-bestiary", "Actor", "Elites", "#6b2f1e", 200000),
    boss: folder("hunt-bestiary", "Actor", "Bosses", "#3b1010", 300000)
};
bestiary.forEach((spec, i) => {
    const data = buildMonster(spec, monFolder[spec.category] ?? monFolder.grunt);
    const _id = id(`actor:${spec.name}`);
    data._id = _id;
    data._key = `!actors!${_id}`;
    data.sort = i * 100;
    data._stats = STATS;
    data.effects = [];
    data.ownership = { default: 0 };
    data.items = (data.items ?? []).map((it, j) => {
        const iid = id(`actor:${spec.name}:item:${it.name}:${j}`);
        return { ...it, _id: iid, _key: `!actors.items!${_id}.${iid}`, effects: [], sort: j * 100, _stats: STATS };
    });
    put("hunt-bestiary", data);
});

// ---------------------------------------------------------------- Traits (Cards)
for (const tier of [1, 2, 3]) {
    const deck = traitDeckData(traits, tier, null);
    const _id = id(`deck:${tier}`);
    deck._id = _id;
    deck._key = `!cards!${_id}`;
    deck.sort = tier * 100;
    deck._stats = STATS;
    deck.cards = deck.cards.map((c, j) => {
        const cid = id(`deck:${tier}:card:${c.name}`);
        return { ...c, _id: cid, _key: `!cards.cards!${_id}.${cid}`, drawn: false, origin: null, _stats: STATS };
    });
    put("hunt-traits", deck);
}

// ---------------------------------------------------------------- Macros
for (const [name, cmd, img, flag, sort] of [
    ["Start of Mission", "game.hunt.startOfMission();", `modules/${MODULE_ID}/assets/logo.svg`, "mission", 100],
    ["End of Exchange", "game.hunt.endOfExchange();", `modules/${MODULE_ID}/assets/exchange.svg`, "exchange", 200]
]) {
    const _id = id(`macro:${name}`);
    put("hunt-macros", { _id, _key: `!macros!${_id}`, name, type: "script", command: cmd, img, scope: "global", sort, folder: null,
        ownership: { default: 0 }, flags: { [MODULE_ID]: { [flag]: true } }, _stats: STATS });
}

// ---------------------------------------------------------------- Rules journal (JournalEntry with pages)
const B = ["Close", "Medium", "Long", "Extreme"];
const ACT = { single: "single", bolt: "bolt", lever: "lever", pump: "pump", double: "double", sa_revolver: "SA revolver", da_revolver: "DA revolver", semi: "semi-auto", melee: "melee", thrown: "thrown" };
const pw = w => B.filter(b => w.power[b] !== null).map(b => `${b[0]}${b === w.best ? "*" : ""} ${w.power[b]}`).join(" / ");
const table = (head, rows) => `<table><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</table>`;
const notes = w => [w.shape === "cone" ? "cone" : "", ...(w.conditions ?? []), w.notes ?? ""].filter(Boolean).map(esc).join("; ");
const gunRows = cat => arsenal.filter(e => e.category === cat).map(e => [esc(e.name), ACT[e.weapon.action], pw(e.weapon), `${e.weapon.capacity} +${e.weapon.reserve}`, e.weapon.reliability, e.weapon.tool ? "tool" : e.weapon.slot, notes(e.weapon)]);
const GUN_HEAD = ["Weapon", "Action", "Power by band (* best)", "Rounds", "Rel.", "Slot", "Notes"];

const skills = Object.values(setup.skills).sort((a, b) => a.name.localeCompare(b.name));
const stuntOf = name => Object.values(setup.stunts).find(s => s.name === name);
const huntersPage = `<h1>Hunters</h1>
<h2>Skills</h2>${table(["Skill", "Use"], skills.map(s => [`<strong>${esc(s.name)}</strong>`, esc(s.description)]))}
<p>Skill pyramid on 20 points: one Great (+4), two Good (+3), three Fair (+2), four Average (+1). A hunter with Physique Great (+4) gets an extra Mild consequence.</p>
<h2>Aspects</h2><p>Four aspects: <strong>High Concept</strong> (who you are), <strong>Trouble</strong> (what keeps going wrong), <strong>Archetype</strong> (your role in the team) and <strong>Bloodline</strong> (where you come from, what you owe).</p>
<h2>Archetypes</h2>${table(["Archetype", "Great", "Good", "Signature stunt", "Suggested starting traits"], archetypes.map(a => {
    const st = stuntOf(a.stunt);
    return [`<strong>${esc(a.name)}</strong><br><em>${esc(a.role)}</em>`, a.great, a.good.join(", "), `<strong>${esc(a.stunt.replace(/ \(.*\)$/, ""))}</strong>: ${(st?.description ?? "").replace(/<\/?p>/g, "")}`, a.traits.join(", ")];
}))}
<p><strong>Custom</strong>: the player picks every skill, aspect and stunt.</p>
<h2>Hunter Creator</h2><p>Actors directory → <strong>Hunter Creator</strong> (or the banner of a hunter sheet to rebuild): name, archetype or Custom, the skill pyramid with the archetype's Great and Goods fixed, the four aspects, the signature stunt, and a starting trait dealt from the deck into the player's hand. Rebuilding replaces skills, aspects and the signature stunt; weapons and marked tracks are kept.</p>`;

const supportPage = `<h1>Support items</h1>
<p><strong>Tools</strong> keep their charges (First Aid Kit: 3 uses), <strong>consumables</strong> leave the sheet once used. Press <strong>Use</strong> on the item's row: the module clears Health boxes, restores Burned chunks, cures conditions or refills spare rounds, spends the charge and posts the effect. The First Aid Kit can be used on a targeted ally in your zone; Doctor doubles it. While <strong>Poisoned</strong>, kits and shots clear no Health box.</p>
${table(["Item", "Kind", "Effect"], arsenal.filter(e => e.category === "support").map(e => [`<strong>${esc(e.name)}</strong>`, e.support.kind + (e.support.usesMax > 1 ? `, ${e.support.usesMax} uses` : ""), esc(e.support.effect.text)]))}`;

const arsenalPage = `<h1>Arsenal</h1>
<p>Drag items from the <strong>Hunt: Arsenal</strong> compendium (or the world's Hunt Arsenal folder) onto a hunter. Damage on a hit is shifts + power, so weapons differ mostly by range, rounds, extra shots, reliability and slot. Power scale: 1 light · 2 compact ammo · 3 medium ammo · 4 long ammo · 5 Sparks · 6 Nitro Express.</p>
<h2>Handguns</h2>${table(GUN_HEAD, gunRows("handgun"))}
<h2>Long guns</h2>${table(GUN_HEAD, gunRows("longgun"))}
<h2>Melee weapons (tools, Fight)</h2>${table(["Weapon", "Power", "Size", "Notes"], arsenal.filter(e => e.category === "melee").map(e => [esc(e.name), e.weapon.power.Close, e.weapon.slot, notes(e.weapon)]))}
<h2>Thrown weapons (tools, Throw)</h2>${table(["Weapon", "Power / range", "Notes"], arsenal.filter(e => e.category === "thrown").map(e => [esc(e.name), e.weapon.explosive ? `fire, radius ${e.weapon.explosive.radius} m, ${e.weapon.capacity} charge(s)` : `${pw(e.weapon)}, ${e.weapon.capacity} carried`, notes(e.weapon)]))}
<h2>Grenades and bombs (consumables)</h2>${table(["Explosive", "Power", "Radius", "Effect"], arsenal.filter(e => e.category === "grenade").map(e => {
    const x = e.weapon.explosive;
    return [esc(e.name), e.weapon.power.Close || "—", `${x.radius} m`, [x.fire ? "fire" : "", x.sticky ? "sticky" : "", ...(e.weapon.conditions ?? []), x.zoneAspect, e.weapon.notes ?? ""].filter(Boolean).map(esc).join(", ")];
}))}`;

const bestiaryPage = `<h1>Bestiary</h1>
${table(["Monster", "Type", "Health", "Armour", "Dread", "Attacks", "Abilities"], bestiary.map(m => [
    `<strong>${esc(m.name)}</strong><br><em>${esc(m.aspect ?? "")}</em>`, m.category, m.health + (m.category === "boss" ? " + consequences" : ""), m.armor || "—", m.dread,
    (m.attacks ?? []).map(a => `${esc(a.name)} (${a.skill}, power ${a.power}${a.conditions?.length ? `, ${a.conditions.join(", ")}` : ""})`).join("<br>"),
    [m.vitalKills ? "Vital hit kills" : "", m.vitalPierces ? "Vital pierces armour" : "", m.volatile ? "Volatile" : "", m.fireproof ? "Fireproof" : "", m.immune?.length ? `Immune: ${m.immune.join(", ")}` : "", ...(m.abilities ?? []).map(a => `<strong>${esc(a.name)}</strong>: ${esc(a.text)}`)].filter(Boolean).join("<br>")
]))}`;

const traitsPage = fs.readFileSync(path.join(ROOT, "packs-src/rules/11-traits.html"), "utf8") +
    [1, 2, 3].map(t => `<h2>Tier ${["I", "II", "III"][t - 1]}</h2>` + table(["Trait", "Cost", "Kind", "Effect"],
        traits.filter(x => x.tier === t).sort((a, b) => a.name.localeCompare(b.name)).map(x => [`<strong>${esc(x.name)}</strong>`, x.cost, x.kind, esc(x.effect)]))).join("");

const file = f => fs.readFileSync(path.join(ROOT, "packs-src/rules", f), "utf8");
const pages = [
    ["Welcome", file("01-welcome.html")],
    ["Fate Core in five minutes", file("02-fate-basics.html")],
    ["Fate points", file("03-fate-points.html")],
    ["Hunters", huntersPage],
    ["Health and harm", file("05-health.html")],
    ["Combat and weapons", file("06-combat.html")],
    ["Explosives and fire", file("07-explosives.html")],
    ["Support items", supportPage],
    ["Monsters", file("09-monsters.html")],
    ["Bestiary", bestiaryPage],
    ["Traits", traitsPage],
    ["Arsenal", arsenalPage]
];
const jid = id("journal:rules");
put("hunt-rules", {
    _id: jid, _key: `!journal!${jid}`, name: "Hunt: Showdown RPG — Rules", folder: null, sort: 0, categories: [],
    ownership: { default: 2 }, flags: {}, _stats: STATS,
    pages: pages.map(([name, html], i) => {
        const pid = id(`journal:rules:page:${name}`);
        return { _id: pid, _key: `!journal.pages!${jid}.${pid}`, name, type: "text", sort: (i + 1) * 100000,
            title: { show: false, level: 1 }, text: { format: 1, content: html, markdown: "" },
            ownership: { default: -1 }, flags: {}, _stats: STATS };
    })
});

// ---------------------------------------------------------------- write sources and compile
const { compilePack } = await import(pathToFileURL(CLI));
const buildDir = path.join(ROOT, "packs-src/_build");
fs.rmSync(buildDir, { recursive: true, force: true });
for (const [pack, docs] of Object.entries(out)) {
    const dir = path.join(buildDir, pack);
    fs.mkdirSync(dir, { recursive: true });
    for (const d of docs) fs.writeFileSync(path.join(dir, `${d._key.replace(/[!.]/g, "_")}.json`), JSON.stringify(d, null, 1));
    const dest = path.join(ROOT, "packs", pack);
    fs.rmSync(dest, { recursive: true, force: true });
    await compilePack(dir, dest, { log: false });
    console.log(`${pack}: ${docs.length} top-level documents`);
}

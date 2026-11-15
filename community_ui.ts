import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";

type Channels = Record<string, string>;
export const GUIDE_TOPICS = ["start", "spiele", "faq", "unterstuetzen"] as const;
export const FAQ_TOPICS = {
  einstieg: "Wie starte ich bei GoR?", rollen: "Wie wähle ich meine Rollen?",
  support: "Wie bekomme ich Hilfe?", projekt: "Wie bringe ich meinen Server mit?",
  unterstuetzen: "Wie kann ich GoR unterstützen?",
} as const;
export const PROJECT_PHASES = {
  neu: "Neu eingegangen", pruefung: "In Prüfung", gespraech: "Im Gespräch",
  pilot: "Pilotphase", aufgenommen: "Aufnahme beschlossen", abgelehnt: "Abgelehnt",
} as const;
export type ProjectPhase = keyof typeof PROJECT_PHASES;
const PHASE_TRANSITIONS: Record<ProjectPhase, readonly ProjectPhase[]> = {
  neu: ["pruefung", "abgelehnt"], pruefung: ["gespraech", "abgelehnt"],
  gespraech: ["pilot", "abgelehnt"], pilot: ["aufgenommen", "abgelehnt"],
  aufgenommen: ["pruefung"], abgelehnt: ["pruefung"],
};
export function isProjectPhase(value: string): value is ProjectPhase {
  return Object.hasOwn(PROJECT_PHASES, value);
}
export function canAdvanceProject(from: string, to: string) {
  return isProjectPhase(from) && isProjectPhase(to) && PHASE_TRANSITIONS[from].includes(to);
}
export function pageWindow<T>(items: T[], requested = 1, size = 8) {
  if (!Number.isSafeInteger(size) || size < 1 || size > 20) throw new Error("Invalid page size");
  const pages = Math.max(1, Math.ceil(items.length / size));
  const page = Math.min(pages, Math.max(1, Number.isSafeInteger(requested) ? requested : 1));
  return { items: items.slice((page - 1) * size, page * size), page, pages, total: items.length };
}
function card(title: string, text: string) {
  return new EmbedBuilder().setColor(0x21cce2).setTitle(title).setDescription(text)
    .setFooter({ text: "GoR Network · Gemeinsam spielen. Gemeinsam wachsen." });
}
function button(id: string, label: string, style = ButtonStyle.Secondary) {
  return new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
}
export function communityNavigation() {
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(
    button("gor:guide:v5:start", "Dein Einstieg", ButtonStyle.Primary),
    button("gor:guide:v5:spiele", "Spiele & Network"), button("gor:roles:open:v5", "Meine Rollen"),
    button("gor:support:v3", "Hilfe bekommen"), button("gor:projekt:v3", "Projekt vorstellen"),
  ), new ActionRowBuilder<ButtonBuilder>().addComponents(
    button("gor:guide:v5:faq", "Häufige Fragen"), button("gor:own:v5", "Meine Anliegen"),
    button("gor:guide:v5:unterstuetzen", "GoR unterstützen"),
  )].map(row => row.toJSON());
}
export function faqView(topic: string | undefined, channels: Channels) {
  const answers: Record<keyof typeof FAQ_TOPICS, string> = {
    einstieg: `Lies <#${channels.regeln}>, wähle mit /rollen deine Interessen und stelle dich in <#${channels.vorstellungen}> vor. In <#${channels.mitspielersuche}> findest du deine nächste Spielrunde.`,
    rollen: "Mit /rollen bestimmst du selbst, welche Spiel- und Benachrichtigungsrollen du möchtest. Du kannst sie jederzeit ändern. Deine anderen Rollen bleiben erhalten.",
    support: `Nutze /support für ein persönliches Anliegen und /meine_faelle für den Bearbeitungsstand. Allgemeine Fragen passen in <#${channels.fragen}>. Das Team arbeitet ehrenamtlich; eine feste Antwortzeit wird nicht versprochen.`,
    projekt: "Alle Spiele sind willkommen. Stelle dein Vorhaben über /projektanfrage vor: Spiel, Konzept, aktueller Stand und gewünschte Zusammenarbeit. Die Leitung prüft es, bespricht die nächsten Schritte und kann eine Pilotphase vereinbaren.",
    unterstuetzen: `Du kannst mit Zeit, Ideen, Technik, Events, Reichweite oder freiwillig finanziell helfen. Zweck und Kostenstand stehen in <#${channels["gor-unterstuetzen"]}> und <#${channels["kosten-und-stand"]}>. Du gehörst auch ohne Zahlung vollständig dazu.`,
  };
  const chosen = topic && Object.hasOwn(FAQ_TOPICS, topic) ? [topic as keyof typeof FAQ_TOPICS] : Object.keys(FAQ_TOPICS) as (keyof typeof FAQ_TOPICS)[];
  const view = card("GoR · Deine Fragen, klare Wege", "Die wichtigsten Antworten für deinen Alltag im Network.")
    .addFields(chosen.map(key => ({ name: FAQ_TOPICS[key], value: answers[key] })));
  return { content: "", embeds: [view.toJSON()], components: communityNavigation() };
}
export function guideView(topic: string, channels: Channels) {
  if (topic === "faq") return faqView(undefined, channels);
  let view: EmbedBuilder;
  if (topic === "spiele") {
    view = card("GoR · Viele Spiele, ein Network", "Dein Lieblingsspiel verbindet dich mit anderen. Dein eigenes Projekt kann Teil von GoR werden.")
      .addFields(
        { name: "Spielen & Leute finden", value: `Aktuelle Projekte: <#${channels.projekte}>\nMitspieler suchen: <#${channels.mitspielersuche}>\nEvents & Termine: <#${channels.termine}>` },
        { name: "Guardians of the Republic", value: `Unser Bereich für Clone Wars Roleplay: <#${channels["cw-start"]}>. Aktuelle Informationen findest du in <#${channels["cw-neuigkeiten"]}>.` },
        { name: "Deinen Server einbringen", value: "Ob Minecraft, Garry’s Mod, Roblox, GTA oder ein anderes Spiel: Stelle dein Konzept über /projektanfrage vor. Ansprechpartner, Zuständigkeiten und Zusammenarbeit werden gemeinsam geklärt." },
        { name: "Der Weg ins Network", value: "Anfrage → Prüfung → Gespräch → Pilotphase → Aufnahmeentscheidung. Eine Anfrage ist noch keine Zusage und verändert keine Besitz- oder Zugriffsrechte." },
      );
  } else if (topic === "unterstuetzen") {
    view = card("GoR · Gemeinsam möglich machen", "Du entscheidest, wie du dich einbringst. Deine Zugehörigkeit hängt von keiner Zahlung ab.")
      .addFields(
        { name: "Zeit & Ideen", value: `Organisiere eine Spielrunde, hilf neuen Mitgliedern oder teile einen Vorschlag in <#${channels.ideen}>.` },
        { name: "Know-how & Reichweite", value: "Du kannst entwickeln, gestalten, bei Events helfen oder GoR passenden Communities vorstellen. Besprich ein konkretes Angebot über /support mit der Leitung." },
        { name: "Freiwillige Finanzierung", value: `Informationen und Verwendungszwecke: <#${channels["gor-unterstuetzen"]}>\nKosten & aktueller Stand: <#${channels["kosten-und-stand"]}>\nZahlungsfragen bitte ausschließlich im privaten Support klären.` },
      );
  } else {
    view = card("Willkommen bei GoR Network", "**Ein Network. Viele Spiele. Deine Community.**\nFinde deine Leute, entdecke Projekte und gestalte mit uns den nächsten Schritt.")
      .addFields(
        { name: "01 · Ankommen", value: `Unsere Regeln: <#${channels.regeln}>\nSag Hallo: <#${channels.vorstellungen}>`, inline: true },
        { name: "02 · Mitspielen", value: `Deine Interessen: /rollen\nGemeinsam loslegen: <#${channels.mitspielersuche}>`, inline: true },
        { name: "03 · Mitgestalten", value: `Deine Idee: <#${channels.ideen}>\nDein Serverprojekt: /projektanfrage`, inline: true },
        { name: "Deine Anlaufstellen", value: `Neuigkeiten: <#${channels.neuigkeiten}> · Projekte: <#${channels.projekte}> · Termine: <#${channels.termine}>\nPersönliche Hilfe: /support · Deine Anfragen: /meine_faelle` },
      );
  }
  return { content: "", embeds: [view.toJSON()], components: communityNavigation() };
}
export function communityHub(channels: Channels) { return guideView("start", channels); }

/** Compare only Discord's stable display fields, accepting snake_case/camelCase adapters. */
export function sameCommunityPanel(message: any, expected: ReturnType<typeof communityHub>, author: string) {
  const shape = (input: any) => ({
    content: input.content || "",
    embeds: (input.embeds || []).map((entry: any) => {
      const e = typeof entry.toJSON === "function" ? entry.toJSON() : entry;
      return { title: e.title, description: e.description, color: e.color, footer: e.footer?.text,
        fields: (e.fields || []).map((f: any) => [f.name, f.value, !!f.inline]),
        extra: !!(e.image || e.thumbnail || e.author || e.url || e.timestamp || e.video || e.provider || e.footer?.icon_url || e.footer?.iconURL) };
    }),
    components: (input.components || []).map((row: any) => (row.components || []).map((entry: any) => {
      const c = typeof entry.toJSON === "function" ? entry.toJSON() : entry;
      return [c.type, c.custom_id ?? c.customId, c.label, c.style, !!c.disabled, c.url ?? null, c.emoji ?? null];
    })),
  });
  return message.author?.id === author && JSON.stringify(shape(message)) === JSON.stringify(shape(expected));
}

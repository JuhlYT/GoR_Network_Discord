import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { communityHub, communityNavigation } from "./community_ui";

type Channels = Record<string, string>;
export type SetupMessage = ReturnType<typeof communityHub>;
function card(title: string, text: string) {
  return new EmbedBuilder().setTitle(title).setDescription(text).setColor(0x21cce2)
    .setFooter({ text: "GoR Network · Gemeinsam spielen. Gemeinsam wachsen." });
}
export function supportView() : SetupMessage {
  return { content: "", embeds: [card("GoR · Wir helfen dir weiter", "**Dein Anliegen. Der passende Kontakt.**\nAllgemeine Hilfe, Technik, Beschwerde, Zahlungsfrage oder ein Projekt für das Network: Wähle deinen Weg.\n\nDein persönliches Anliegen wird in einem privaten Fall aufgenommen. Den Bearbeitungsstand findest du mit /meine_faelle. Das Team arbeitet ehrenamtlich; feste Antwortzeiten werden nicht versprochen.\n\nBitte keine Passwörter, Tokens oder vollständigen Zahlungsdaten senden.").toJSON()],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("gor:support:v3").setLabel("Privaten Support öffnen").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("gor:projekt:v3").setLabel("Projekt vorstellen").setStyle(ButtonStyle.Secondary),
    ).toJSON()] };
}
export const MESSAGE_KEYS = ["start", "regeln", "projekte", "gor-unterstuetzen", "kosten-und-stand", "support", "netzwerk-aufnahme", "kontakt", "cw-start", "ideen", "team-info"];
export function setupMessage(key: string, channels: Channels): SetupMessage {
  if (key === "start") return communityHub(channels);
  if (key === "support") return supportView();
  const views: Record<string, EmbedBuilder> = {
    regeln: card("GoR · Gemeinsam fair bleiben", "Diese Regeln gelten im gesamten Network. Die jeweiligen Spiel- und Projektregeln kommen im Spiel dazu.").addFields(
      { name: "01 · Respekt", value: "Behandle andere respektvoll. Belästigung, diskriminierende Angriffe und gezielte Bloßstellung haben hier keinen Platz." },
      { name: "02 · Privatsphäre", value: "Teile keine fremden persönlichen Daten, privaten Gespräche oder Bilder ohne Zustimmung. Zugangsdaten gehören nie in den Discord." },
      { name: "03 · Fair spielen", value: "Keine Cheats, Betrugsversuche, schädlichen Links oder gezielte Störung von Spielrunden. Melde Probleme über den Support." },
      { name: "04 · Passender Ort", value: "Nutze die passenden Kanäle. Keine massenhaften Erwähnungen, kein Spam und keine ungefragte Werbung. Serverprojekte werden über /projektanfrage vorgestellt." },
      { name: "05 · Miteinander klären", value: "Führe Kritik sachlich. Beschwerden und persönliche Konflikte gehören in den privaten Support; Entscheidungen können dort zur Prüfung vorgelegt werden." },
      { name: "06 · Verantwortung", value: "Das Team entscheidet anhand des konkreten Falls. Finanzierung oder Rang ersetzen weder die Regeln noch einen respektvollen Umgang." },
    ),
    projekte: card("GoR · Ein Network, viele Möglichkeiten", `**Alle Spiele sind willkommen.**\nWir verbinden Menschen, Spielrunden und eigenständige Serverprojekte.\n\n**Guardians of the Republic · Clone Wars RP**\nEinstieg: <#${channels["cw-start"]}> · Projektmeldungen: <#${channels["cw-neuigkeiten"]}>\n\n**Dein Projekt kann dazugehören**\nStelle Spiel, Konzept und gewünschte Zusammenarbeit über /projektanfrage vor. Die Leitung prüft die Anfrage und stimmt eine mögliche Pilotphase mit dir ab.\n\nAktuelle Projektstände werden vom zuständigen Team veröffentlicht; eine Anfrage ist noch keine Aufnahmezusage.`),
    "gor-unterstuetzen": card("GoR · Gemeinsam möglich machen", `GoR lebt von freiwilliger Unterstützung. **Du gehörst auch ohne Zahlung vollständig dazu.**\n\n**Zeit & Ideen:** Hilf neuen Mitgliedern, organisiere Spielrunden oder teile Vorschläge in <#${channels.ideen}>.\n**Know-how:** Entwicklung, Gestaltung, Moderation und Eventorganisation helfen dem Network weiter. Konkrete Angebote besprichst du über /support.\n**Freiwillige Finanzierung:** Verwende die aktuell veröffentlichten Wege und Verwendungszwecke. Kosten und Stand: <#${channels["kosten-und-stand"]}>.\n\nCommunity-Finanzierung und persönliche Aufrufe müssen mit ihrem jeweiligen Zweck klar erkennbar sein. Zahlungsanliegen bleiben privat.`),
    "kosten-und-stand": card("GoR · Kosten & Finanzierung", `Hier veröffentlicht die Leitung die freigegebenen Kosten, bestätigten Eingänge und aktuellen Ziele des Networks.\n\n**Ein transparenter Bericht nennt:** Zeitraum, laufende Kosten, bestätigten Finanzierungsstand und nächsten Bedarf. Unbestätigte Zusagen werden getrennt ausgewiesen.\n\nEs werden keine Namen einzelner Unterstützer oder persönlichen Zahlungsdaten ohne deren Zustimmung veröffentlicht. Aktuelle Berichte stehen unter dieser Infotafel. Für persönliche Rückfragen nutze /support.`),
    "netzwerk-aufnahme": card("Dein Server · Teil von GoR", "Ob Garry’s Mod, Minecraft, Roblox, GTA oder ein anderes Spiel: Wir möchten Projekte zusammenbringen, die miteinander wachsen wollen.").addFields(
      { name: "Deine Vorstellung", value: "Projektname · Spiel & Modus · aktueller Stand · Team & Spieler · gewünschte Zusammenarbeit. Starte mit /projektanfrage." },
      { name: "Der gemeinsame Weg", value: "Anfrage → Prüfung → Gespräch → Pilotphase → Aufnahmeentscheidung. Den aktuellen Stand siehst du mit /meine_faelle." },
      { name: "Klare Absprachen", value: "Ansprechpartner, Zuständigkeiten, Kosten und Zugriffe werden gemeinsam vereinbart. Es gibt keine automatische Übertragung von Eigentum oder fremden Serverrechten." },
    ),
    kontakt: card("GoR · Kontakt & offizielle Anlaufstellen", `**Persönliche Hilfe:** /support\n**Deine Anfragen:** /meine_faelle\n**Ein Serverprojekt vorstellen:** /projektanfrage\n\nCommunity-Portal: https://gornetwork.de\nInformationen zur Unterstützung: <#${channels["gor-unterstuetzen"]}>\n\nRechtliche Angaben und Kontaktmöglichkeiten zu einzelnen Angeboten stehen auf der jeweiligen offiziellen Website. Zugangsdaten und persönliche Zahlungsunterlagen gehören nicht in öffentliche Kanäle.`),
    "cw-start": card("Guardians of the Republic · Clone Wars RP", `**Deine Geschichte in der Republik beginnt hier.**\nEntdecke gemeinsames Roleplay, Ausbildung und Einsätze mit deiner Einheit.\n\n**Vor dem Einstieg:** Lies die aktuellen Projektinformationen und die im Spiel geltenden Regeln. Neuigkeiten: <#${channels["cw-neuigkeiten"]}>.\n**Mitmachen:** Wähle mit /rollen deine Clone-Wars-Interessen. Austausch: <#${channels["cw-austausch"]}> · Termine: <#${channels["cw-events"]}>.\n**Verbessern:** Fehler in <#${channels["cw-fehler"]}>, Vorschläge in <#${channels["cw-ideen"]}>. Persönliche Anliegen bitte über /support.`).setColor(0x77a9e8),
    ideen: card("GoR · Deine Idee zählt", "Stelle einen Vorschlag möglichst mit einem klaren Ziel vor. Eine Idee pro Beitrag oder Thread hält die Diskussion übersichtlich.").addFields(
      { name: "Eine gute Vorlage", value: "**Idee:** Was möchtest du ändern?\n**Nutzen:** Wem hilft es?\n**Umsetzung:** Was braucht es dafür?\n**Offene Punkte:** Was sollte gemeinsam geklärt werden?" },
      { name: "Rückmeldung", value: "Das Team kann Vorschläge prüfen, Rückfragen stellen und eine Entscheidung begründen. Ein Vorschlag ist keine Zusage; persönliche Beschwerden gehören in den privaten Support." },
    ),
    "team-info": card("GoR · Gemeinsam Verantwortung tragen", "Klare Zuständigkeiten, nachvollziehbare Entscheidungen und ein freundlicher Umgang machen gute Communityarbeit aus.").addFields(
      { name: "Dein Arbeitsplatz", value: "/team zeigt deine Zuständigkeiten. /faelle zeigt offene Anliegen. /uebernehmen übernimmt einen passenden Fall; /schliessen schließt einen eigenen oder zugewiesenen Fall ab." },
      { name: "Vertraulichkeit", value: "Persönliche Falldetails bleiben im zugehörigen privaten Kanal. Zahlungsfälle gehören zur Finanzzuständigkeit; Teambereiche ersetzen keine Fallberechtigung." },
      { name: "Projektaufnahme", value: "Die zuständige Leitung prüft Projektanfragen und dokumentiert deren Phase mit /projektstatus. Eigene Anfragen werden durch eine andere zuständige Leitung geprüft." },
      { name: "Serverpflege", value: "/einrichtung zeigt den Stand der automatischen GoR-Einrichtung. Der Inhaber kann einen Lauf starten, die Automatik pausieren oder eine unklare Anlage zuordnen." },
    ),
  };
  const view = views[key];
  if (!view) throw Object.assign(new Error("Unknown managed message"), { setupCode: "invalid_resource" });
  return { content: "", embeds: [view.toJSON()], components: key === "team-info" ? [] : communityNavigation() };
}

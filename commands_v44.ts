import { SlashCommandBuilder } from "discord.js";
import { IDEA_STATUS, PRIVACY_KINDS } from "./community_state";

export function commands44() {
  const command=(name:string,description:string)=>new SlashCommandBuilder().setName(name).setDescription(description).setDefaultMemberPermissions(null).setNSFW(false);
  const finance=command("finanzbericht","Geprüfte Network-Zahlen und getrennte Unterstützungszwecke anzeigen.")
    .addStringOption(o=>o.setName("aktion").setDescription("Bericht ansehen oder eine private Vorschau vorbereiten").addChoices({name:"Anzeigen",value:"anzeigen"},{name:"Entwurf vorbereiten",value:"entwurf"}))
    .addStringOption(o=>o.setName("zeitraum").setDescription("Berichtsmonat, z. B. 2026-11").setMaxLength(7));
  for(const [name,label] of [["eingaenge","Bestätigte Network-Eingänge"],["erstattungen","Network-Erstattungen"],["gebuehren","Tatsächliche Zahlungsgebühren"],["ausgaben","Network-Ausgaben ohne Feuerwehrweitergabe"],["anfangsbestand","Für diesen Zweck verfügbarer Anfangsbestand"],["reserve","Zulässige gebundene Rücklage"],["privat","Private Beiträge, getrennt vom Network"],["feuerwehr","Weitergabe aus der Network-Abrechnung"]])
    finance.addNumberOption(o=>o.setName(name).setDescription(label+" in Euro").setMinValue(0).setMaxValue(1_000_000));
  finance.addBooleanOption(o=>o.setName("zwecke_geprueft").setDescription("Alte Zusagen, Mittelzuordnung und Empfänger wurden geprüft"));
  return [
    command("rechtliches","Betreiberangaben, Datenschutz und erreichbare Kontaktwege öffnen."),
    command("meine_daten","Nur deine eigenen Bot-Metadaten und weitere Auskunftswege anzeigen.")
      .addBooleanOption(o=>o.setName("download").setDescription("Eigene Metadaten zusätzlich als private JSON-Datei")),
    command("datenanfrage","Eine Auskunft, Berichtigung oder Löschprüfung privat anfragen.")
      .addStringOption(o=>o.setName("art").setDescription("Worum geht es?").addChoices(...Object.entries(PRIVACY_KINDS).map(([value,name])=>({name,value})))),
    command("beschwerde","Eine Beschwerde an eine unbeteiligte zuständige Person richten.")
      .addUserOption(o=>o.setName("gegen").setDescription("Optional: betroffene Person; sie darf nicht über sich selbst entscheiden")),
    command("einspruch","Einen eigenen Fall überprüfen lassen; externer Weg für gesperrte Mitglieder.")
      .addIntegerOption(o=>o.setName("fall").setDescription("Optional: eigene ursprüngliche Fallnummer").setMinValue(1)),
    command("ideen","Vorschläge einreichen, ihren Stand ansehen oder begründet bearbeiten.")
      .addStringOption(o=>o.setName("aktion").setDescription("Was möchtest du tun?").addChoices(...[["Anzeigen","anzeigen"],["Meine Vorschläge","eigen"],["Vorschlagen","vorschlagen"],["Status bearbeiten","status"]].map(([name,value])=>({name,value}))))
      .addIntegerOption(o=>o.setName("seite").setDescription("Seite der Vorschlagsübersicht").setMinValue(1).setMaxValue(10000))
      .addIntegerOption(o=>o.setName("id").setDescription("Vorschlagsnummer").setMinValue(1))
      .addStringOption(o=>o.setName("status").setDescription("Neuer Bearbeitungsstand").addChoices(...Object.entries(IDEA_STATUS).map(([value,name])=>({name,value}))))
      .addStringOption(o=>o.setName("begruendung").setDescription("Öffentliche sachliche Begründung ohne persönliche Daten").setMaxLength(500)),
    command("events","Öffentliche Veranstaltungen entdecken oder als Eventteam planen.")
      .addStringOption(o=>o.setName("aktion").setDescription("Was möchtest du tun?").addChoices(...[["Anzeigen","anzeigen"],["Veranstaltung planen","planen"],["Veranstaltung absagen","absagen"],["Unklare Anlage zuordnen","zuordnen"]].map(([name,value])=>({name,value}))))
      .addStringOption(o=>o.setName("titel").setDescription("Öffentlicher Veranstaltungstitel").setMaxLength(100))
      .addStringOption(o=>o.setName("beginn").setDescription("Mit Zeitzone, z. B. 2026-11-21T19:00+01:00").setMaxLength(40))
      .addIntegerOption(o=>o.setName("dauer").setDescription("Dauer in Minuten").setMinValue(5).setMaxValue(1440))
      .addStringOption(o=>o.setName("ort").setDescription("Spiel / Treffpunkt; keine privaten Zugangsdaten").setMaxLength(100))
      .addStringOption(o=>o.setName("beschreibung").setDescription("Öffentliche Beschreibung ohne persönliche Daten").setMaxLength(900))
      .addStringOption(o=>o.setName("event").setDescription("Discord-ID der eigenen Veranstaltung").setMinLength(15).setMaxLength(22))
      .addStringOption(o=>o.setName("vorgang").setDescription("Vorgang aus einer unklaren Anlage").setMaxLength(36)),
    finance,
    command("update_vorschau","Inhaber: konkrete Änderungen am GoR-Aufbau vor der Ausführung prüfen."),
    command("update_anwenden","Inhaber: genau eine noch aktuelle Änderungsvorschau anwenden.")
      .addStringOption(o=>o.setName("vorgang").setDescription("ID der persönlichen Änderungsvorschau").setRequired(true).setMinLength(36).setMaxLength(36)),
  ];
}

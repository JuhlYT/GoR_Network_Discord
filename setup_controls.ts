import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export const SETUP_CONTROLS = {
  start: "gor:setup:start:v6", pause: "gor:setup:pause:v6", resume: "gor:setup:resume:v6",
  preview: "gor:setup:preview:v6",
} as const;
export function setupControl(action: string) { return Object.values(SETUP_CONTROLS).includes(action as any); }
export function setupPolicy(storage: string) {
  return storage === "temporary"
    ? { allowCreate: false, label: "Automatische Gestaltung vorhandener GoR-Bereiche", notice: "Rollen, Kanalgestaltung, Rechte und vorhandene eigene Infotafeln werden gepflegt. Neue Anlagen benötigen das dauerhafte Einrichtungsjournal. Private Anfragen bleiben bis dahin pausiert." }
    : { allowCreate: true, label: "Vollständige automatische Servergestaltung", notice: "Der Bot ergänzt fehlende GoR-Bereiche und pflegt Rollen, Kanäle, Rechte, eigene Infotafeln und native Community-Einstellungen." };
}
export function setupButtons(paused: boolean) {
  const make=(id:string,label:string,style=ButtonStyle.Secondary)=>new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      make(SETUP_CONTROLS.start,"Server jetzt gestalten",ButtonStyle.Success),
      make(SETUP_CONTROLS.preview,"Änderungen ansehen")),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      make(paused?SETUP_CONTROLS.resume:SETUP_CONTROLS.pause,paused?"Automatik fortsetzen":"Automatik pausieren"),
      make("gor44:status","Botstatus")),
  ].map(row=>row.toJSON());
}

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, AttachmentBuilder } from "discord.js";
import { SETUP_ISSUES, type SetupProgress, type SetupReport } from "./auto_setup";

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

type FeedbackContext = { version:string; storage:string; allowCreate:boolean };
const feedbackCard=(title:string,description:string)=>new EmbedBuilder().setColor(0xd9ab56).setTitle(title).setDescription(description)
  .setFooter({text:"GoR Network · Servergestaltung"}).toJSON();
export function setupProgressView(progress:SetupProgress|undefined, context:FeedbackContext) {
  return {embeds:[feedbackCard("GoR · Einrichtung läuft",
    `**Version:** ${context.version}\n${progress?`**Prüfschritte:** ${progress.completed}/${progress.total}\n**Aktueller Schritt:** \`${progress.key}\`\n**Bestätigt:** ${progress.created} angelegt · ${progress.updated} aktualisiert · ${progress.issues} Punkte offen`:"Der Abgleich wird vorbereitet oder ein bereits laufender Abgleich wird mitverfolgt."}\n\nDas Ergebnis folgt in dieser Antwort. Ein Start ist noch keine Bestätigung erfolgter Änderungen.`)]};
}
export function setupResultView(report:SetupReport,context:FeedbackContext) {
  const issues=report.issues, unchanged=!issues.length && !report.created && !report.updated;
  const title=issues.length?"GoR · Einrichtung mit offenen Punkten":unchanged?"GoR · Bereits passend":"GoR · Einrichtung abgeschlossen";
  let text=`**Version:** ${context.version}\n**Bestätigt:** ${report.created} angelegt · ${report.updated} aktualisiert · ${report.unchanged} bereits passend\n**Offene Punkte:** ${issues.length}\n**Datenhaltung:** ${context.storage}\n\n`;
  text+=unchanged?"Es waren keine sichtbaren Änderungen nötig. Die geprüften Bereiche entsprechen dem aktuell im Bot hinterlegten GoR-Aufbau.":
    issues.length?"Die folgenden Punkte verhindern einzelne Änderungen. Die Startmeldung wird nicht als erfolgreicher Abschluss gewertet.":
    "Discord hat den ausgeführten Abgleich bestätigt.";
  if(issues.length) text+="\n\n"+issues.slice(0,6).map(item=>`**${item.key}**\n${SETUP_ISSUES[item.code]||SETUP_ISSUES.unexpected_error}`).join("\n\n");
  const codes=new Set(issues.map(item=>item.code));
  const next:string[]=[];
  if(codes.has("storage_required"))next.push("**Speicher:** Für neue Rollen, Kanäle oder Infotafeln ein tatsächliches Volume mit dem Botdienst verbinden. Vorhandene bekannte Bereiche werden weiter gepflegt.");
  if(codes.has("role_uneditable")||codes.has("role_safety"))next.push("**Rangfolge:** Die Botrolle muss über den zu verwaltenden GoR-Rollen liegen. Discord erlaubt dem Bot nicht, seine eigene Rolle selbst höher zu setzen.");
  if(codes.has("missing_permissions"))next.push("**Rechte:** Rollen verwalten, Kanäle verwalten und Server verwalten sowie die Lese- und Schreibrechte des betroffenen Kanals prüfen.");
  if(codes.has("dependency_missing"))next.push("**Abhängigkeiten:** Zuerst die oben gemeldeten fehlenden Rollen oder Kategorien klären; davon abhängige Bereiche bleiben bis dahin offen.");
  if(codes.has("creation_unknown")||codes.has("name_conflict")||codes.has("duplicate_marker"))next.push("**Zuordnung:** Vorhandenen Eintrag mit /einrichtung_zuordnen bestätigen. Unklare Anlagen werden nicht automatisch doppelt erstellt.");
  if(next.length)text+="\n\n"+next.join("\n\n");
  text+="\n\nDie vollständige Liste steht im beigefügten Einrichtungsbericht. /einrichtung zeigt den aktuellen Stand.";
  const payload={version:context.version,storage:context.storage,allowCreate:context.allowCreate,at:report.at,status:report.status,
    confirmed:{created:report.created,updated:report.updated,unchanged:report.unchanged},issues:issues.map(item=>({key:item.key,code:item.code}))};
  return {embeds:[feedbackCard(title,text)],files:[new AttachmentBuilder(Buffer.from(JSON.stringify(payload,null,2)),{name:"GoR_Einrichtungsbericht.json"})]};
}
export async function followSetup(options:FeedbackContext & {
  task:()=>Promise<SetupReport|undefined>; progress:()=>SetupProgress|undefined;
  reply:(view:Record<string,any>)=>Promise<void>; intervalMs?:number;
}) {
  // Attach both result handlers immediately, including when a previously running preview is joined.
  const outcome=options.task().then(report=>({report}),()=>({report:undefined}));
  await options.reply(setupProgressView(options.progress(),options));
  let pending=Promise.resolve(),updating=false;
  const timer=setInterval(()=>{
    if(updating)return;updating=true;
    pending=options.reply(setupProgressView(options.progress(),options)).catch(()=>{}).finally(()=>{updating=false;});
  },options.intervalMs??5000);timer.unref();
  try {
    const {report}=await outcome;
    clearInterval(timer);await pending;
    if(report)await options.reply(setupResultView(report,options));
    else await options.reply({embeds:[feedbackCard("GoR · Kein Abgleich bestätigt",
      "Der Vorgang wurde nicht als ausgeführte Servergestaltung bestätigt. Bitte den aktuellen Botstatus und /einrichtung prüfen. Es wird kein erfolgreicher Abschluss behauptet.")]});
  } finally {clearInterval(timer);}
}

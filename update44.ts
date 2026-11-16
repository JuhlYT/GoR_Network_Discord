import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, GuildScheduledEventStatus,
  ModalBuilder, PermissionFlagsBits as P, TextInputBuilder, TextInputStyle, escapeMarkdown, type GuildMember } from "discord.js";
import type { Store } from "./gor_network";
import { CommunityState, IDEA_STATUS, PRIVACY_KINDS, type CasePreset, type CaseRecord } from "./community_state";
import { LEGAL_FIELDS, legalConfig, saveLegalLinks, privacyContacts, legalDigest } from "./legal_config";
import { Retention } from "./retention";
import { RemoteBackup } from "./backup_remote";
import { captureChangePlan, setProtection, protections } from "./change_plan";
import { financeReport, financeBalance, eventDraft, publishEvent, recoverEvent, type FinanceReport } from "./community_actions";
import { DAY, PublicError, money, timestamp, snowflake, cleanText } from "./feature_base";
import type { SetupMaps, SetupReport } from "./auto_setup";

type Context = {
  store:Store; env:Record<string,string|undefined>; guild:string; application:string; version:string; maps:SetupMaps;
  answer:(i:any,content:string,extra?:Record<string,any>)=>Promise<void>;
  createCase:(i:any,member:GuildMember,kind:string,preset?:CasePreset)=>Promise<void>;
  caseChannel:(guild:any,c:CaseRecord)=>Promise<any>;
  serial:<T>(fn:()=>Promise<T>)=>Promise<T>;
  applySetup:(before:()=>Promise<void>)=>Promise<SetupReport|undefined>;
  status:()=>Record<string,string|number|boolean>;
  reviewAccess?:()=>Promise<void>;
};
const color=0xd9ab56;
const button=(id:string,label:string,style=ButtonStyle.Secondary)=>new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
const row=(...buttons:ButtonBuilder[])=>new ActionRowBuilder<ButtonBuilder>().addComponents(buttons).toJSON();
const card=(title:string,text:string)=>new EmbedBuilder().setColor(color).setTitle(title).setDescription(text).setFooter({text:"GoR Network · Gemeinsam spielen. Klar geregelt."});
const excerpt=(value:string,max:number)=>escapeMarkdown(value).slice(0,max).replace(/\\$/g,"");
function modal(id:string,title:string,fields:{id:string;label:string;max:number;long?:boolean;required?:boolean;value?:string;placeholder?:string}[]) {
  return new ModalBuilder().setCustomId(id).setTitle(title).addComponents(fields.map(f=>new ActionRowBuilder<TextInputBuilder>().addComponents(
    new TextInputBuilder().setCustomId(f.id).setLabel(f.label).setStyle(f.long?TextInputStyle.Paragraph:TextInputStyle.Short)
      .setMaxLength(f.max).setRequired(f.required!==false).setValue(f.value||"").setPlaceholder(f.placeholder||"Bitte keine Passwörter oder sensiblen Daten"))));
}
function own(member:GuildMember) { if(member.id!==member.guild.ownerId) throw new PublicError("Diese Einstellung verwaltet der Serverinhaber."); }

export class Update44 {
  readonly state:CommunityState;
  readonly retention:Retention;
  readonly backup:RemoteBackup;
  lastMaintenance=0;
  constructor(readonly ctx:Context) {
    this.state=new CommunityState(ctx.store.db,ctx.guild);
    this.retention=new Retention(ctx.store,this.state,ctx.caseChannel);
    this.backup=new RemoteBackup(ctx.store,ctx.guild,ctx.env,()=>this.retention.ledger.export());
  }
  links() { return legalConfig(this.ctx.store,this.ctx.env); }
  publicLinks() { const c=this.links();return c.reviewed?c.links:c.links.contact?{contact:c.links.contact}:{}; }
  isPrivacyContact(id:string) { return privacyContacts(this.ctx.store,this.ctx.env).includes(id); }
  canHandle(c:CaseRecord,member:GuildMember,base:boolean) {
    if(this.state.excluded(c.id,member.id)) return false;
    if(["datenschutz","beschwerde","einspruch"].includes(c.kind) && c.opener_id===member.id) return false;
    if(c.kind==="datenschutz") return member.id===member.guild.ownerId || this.isPrivacyContact(member.id);
    return base;
  }
  leading(member:GuildMember) {
    return member.id===member.guild.ownerId || ["networkleitung","communityleitung"].some(k=>member.roles.cache.has(this.ctx.maps.roles[k]));
  }
  finance(member:GuildMember) { return member.id===member.guild.ownerId || member.roles.cache.has(this.ctx.maps.roles.finanzen); }
  eventTeam(member:GuildMember) { return this.leading(member) || member.roles.cache.has(this.ctx.maps.roles.eventteam); }
  async send(i:any,title:string,text:string,components:any[]=[],extra:Record<string,any>={}) {
    await this.ctx.answer(i,"",{embeds:[card(title,text).toJSON()],components,...extra});
  }
  async status(i:any) {
    const s=this.ctx.status(), legal=this.links();
    await this.send(i,"GoR · Betrieb & Kontakt",`**Version:** ${this.ctx.version}\n**Discord:** ${s.connected?"verbunden":"Verbindung wird hergestellt"}\n**Befehle:** ${s.commands?`${s.commandCount}/${s.commandTotal} bestätigt`: "Registrierung wird geprüft"}\n**Serverpflege:** ${s.setup}\n**Datenhaltung:** ${s.storage}\n**Externe Sicherung:** ${this.backup.state==="verified"?"verschlüsselt bestätigt":"Einrichtung / Prüfung offen"}\n\n**Kontaktwege:** ${legal.ready?"vom Inhaber bestätigt":"Angaben werden vervollständigt"}\nRechtliche Informationen und Kontakt: /rechtliches.\nDas bestätigt technische Zustände, keine juristische Abnahme.`,[row(button("gor44:legal","Kontakt & Rechtliches"))]);
  }
  async legal(i:any) {
    const c=this.links(), visible=this.publicLinks();
    const buttons=Object.entries(visible).filter(([,url])=>!!url).map(([key,url])=>new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(LEGAL_FIELDS[key as keyof typeof LEGAL_FIELDS][0]).setURL(url!));
    await this.send(i,"GoR · Rechtliches & Kontakt",`Regeln: <#${this.ctx.maps.channels.regeln}>\n${c.ready?"Die hinterlegten Kontakt- und Informationswege wurden vom Inhaber bestätigt.":"Die vollständigen Betreiber- und Datenschutzangaben werden noch ergänzt. Die Leitung sieht die offenen Punkte unter /einrichtung."}\n\n**Deine Daten:** /meine_daten · Anfrage: /datenanfrage\n**Beschwerden:** /beschwerde · Überprüfung: /einspruch\n\nFür Zahlungsprobleme den geschützten externen Kontakt verwenden. Keine Bank-, Karten-, Ausweis- oder vollständigen Belegdaten im Discord senden. Gesperrte Mitglieder benötigen den externen Kontaktweg.`,buttons.length?[row(...buttons)]:[]);
  }
  async payment(i:any) {
    const c=this.links(), url=c.links.payment;
    await this.send(i,"GoR · Zahlungsfragen geschützt klären",url?"Nutze den geschützten Kontakt des tatsächlichen Zahlungsempfängers. Dieser Bot erfasst keine Zahlungsunterlagen. Bitte sende hier weder Bank- oder Kartendaten noch vollständige Belege.":`Der externe Zahlungs-Kontakt ist noch nicht hinterlegt. Bitte die Networkleitung in <#${this.ctx.maps.channels.kontakt}> ausschließlich um diesen Kontaktweg bitten. Zahlungsdetails nicht in Discord senden.`,url?[row(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Geschützten Kontakt öffnen").setURL(url))]:[]);
  }
  /** Opening a form does not grant any permissions. Every submission is checked again with a fresh member. */
  modalFor(i:any) {
    if(i.isButton?.() && i.customId==="gor44:settings") {
      if(i.user.id!==i.guild?.ownerId) throw new PublicError("Diese Einstellung verwaltet der Serverinhaber.");
      const links=this.links().links;
      return modal("gor44:settings:save","Kontaktwege einrichten",Object.entries(LEGAL_FIELDS).map(([id,[label]])=>({id,label,max:500,required:false,value:links[id as keyof typeof links],placeholder:"Öffentliche HTTPS-Seite ohne persönliche Zugangsparameter"})));
    }
    const command=i.isChatInputCommand?.()?i.commandName:"";
    if(command==="datenanfrage" || (i.isStringSelectMenu?.() && i.customId==="gor:kind:v4" && i.values[0]==="datenschutz")) {
      const kind=command?i.options.getString("art")||"auskunft":"auskunft";
      if(!Object.hasOwn(PRIVACY_KINDS,kind)) throw new PublicError("Bitte eine gültige Anfrageart wählen.");
      return modal("gor44:privacy:"+kind,"Datenschutzanfrage",[{id:"details",label:"Worum geht es? Keine sensiblen Daten",max:700,long:true,placeholder:"Kurze Beschreibung; weitere Unterlagen über externen Kontakt"}]);
    }
    if(command==="beschwerde" || (i.isStringSelectMenu?.() && i.customId==="gor:kind:v4" && i.values[0]==="beschwerde")) {
      const target=command?i.options.getUser("gegen")?.id:"none";
      return modal("gor44:complaint:"+(target||"none"),"Beschwerde einreichen",[{id:"summary",label:"Worum geht es?",max:100},{id:"details",label:"Sachverhalt; keine sensiblen Unterlagen",max:1000,long:true}]);
    }
    if(command==="einspruch" || (i.isStringSelectMenu?.() && i.customId==="gor:kind:v4" && i.values[0]==="einspruch")) {
      const related=command?i.options.getInteger("fall")||0:0;
      return modal("gor44:appeal:"+related,"Überprüfung anfragen",[{id:"summary",label:"Was soll überprüft werden?",max:100},{id:"details",label:"Begründung; keine sensiblen Unterlagen",max:1000,long:true}]);
    }
    if((command==="ideen" && i.options.getString("aktion")==="vorschlagen") || (i.isButton?.() && i.customId==="gor44:ideas:new")) return modal("gor44:idea:new","Öffentlichen Vorschlag einreichen",[
      {id:"title",label:"Öffentlicher Titel",max:100},{id:"body",label:"Öffentliche Idee - keine persönlichen Angaben",max:1500,long:true,placeholder:"Dein Text wird in der Ideenübersicht angezeigt."}]);
    return null;
  }
  settingsButtons() { return [row(button("gor44:settings","Kontaktwege einrichten"),button("gor44:settings:review","Links geprüft bestätigen")),row(button("gor44:retention:list","Aufbewahrung prüfen"),button("gor44:status","Betrieb prüfen"))]; }
  readiness() {
    const c=this.links(); return `Kontaktwege: ${c.ready?"bestätigt":"offen"}${c.missing.length?" · fehlt: "+c.missing.join(", "):""}\nAufbewahrung: einzeln geprüfte Kanallöschung; Altbestand zunächst einstufen.\nUnabhängige Sicherung: ${this.backup.state==="verified"?"verschlüsselt bestätigt":"noch nicht bestätigt"}\nGeschützte Gestaltungsfelder: ${Object.keys(protections(this.ctx.store)).length}`;
  }
  async maintenance() {
    this.state.cleanup(); this.retention.sweep();
    if(this.ctx.status().connected)await this.ctx.reviewAccess?.();
    await this.backup.run(); this.lastMaintenance=timestamp();
  }
  async ideas(i:any,member:GuildMember) {
    const action=i.options?.getString("aktion")||"anzeigen";
    if(action==="status") {
      if(!this.leading(member)) throw new PublicError("Den Ideenstatus bearbeitet die Community- oder Networkleitung.");
      const id=i.options.getInteger("id"),status=i.options.getString("status"),reason=i.options.getString("begruendung");
      if(!id || !status || !reason) throw new PublicError("Bitte Vorschlagsnummer, Status und öffentliche Begründung angeben.");
      this.state.decideIdea(id,status,reason,member.id); this.ctx.store.audit(member.id,"idea_decision",String(id));
      await this.send(i,"GoR · Vorschlag bearbeitet",`Vorschlag #${id}: **${IDEA_STATUS[status as keyof typeof IDEA_STATUS]}**\n${escapeMarkdown(reason)}`); return;
    }
    const page=i.options?.getInteger("seite")||1, rows=this.state.ideas(page,action==="eigen"?member.id:undefined);
    await this.send(i,"GoR · Ideen mit nachvollziehbarem Stand",rows.length?rows.map(r=>`**#${r.id} · ${excerpt(r.title,120)}**\n${IDEA_STATUS[r.status as keyof typeof IDEA_STATUS]}\n${excerpt(r.body,300)}${escapeMarkdown(r.body).length>300?" …":""}${r.decision?"\nBegründung: "+excerpt(r.decision,170):""}`).join("\n\n"):"Hier sind noch keine Vorschläge vorhanden. Reiche mit /ideen aktion:vorschlagen deine öffentliche Idee ein.",[row(button("gor44:ideas:new","Vorschlag einreichen"))]);
  }
  financeText(r:FinanceReport) {
    return `**Zeitraum:** ${r.period}\n**Network**\nAnfangsbestand: ${money(r.opening)}\nBestätigte Eingänge: ${money(r.received)}\nErstattungen: ${money(r.refunds)} · Gebühren: ${money(r.fees)}\nBetrieb / Entwicklung: ${money(r.costs)}\nWeitergabe an die Feuerwehr: ${money(r.charity)}\nAusgewiesener verbleibender Bestand: ${money(financeBalance(r))}\nDavon gebundene zulässige Rücklage: ${money(r.reserve)}\n\n**Privater Aufruf:** ${money(r.personal)} Beiträge im Zeitraum, getrennt vom Network.\n\nDie Zahlen wurden manuell geprüft. Keine Einzelzahlerdaten. Bestehende Zweckzusagen gelten weiter; Unterstützung verschafft keine Sonderrechte. Dies ist keine Zuwendungsbestätigung.`;
  }
  async financeView(i:any,member:GuildMember) {
    if((i.options?.getString("aktion")||"anzeigen")==="entwurf") {
      if(!this.finance(member)) throw new PublicError("Finanzberichte bereitet die Finanzzuständigkeit oder der Inhaber vor.");
      if(!i.options.getBoolean("zwecke_geprueft")) throw new PublicError("Bitte zuerst tatsächliche Zahlen, alte Zweckzusagen und Empfänger prüfen und zwecke_geprueft bestätigen.");
      const mapping={received:"eingaenge",refunds:"erstattungen",fees:"gebuehren",costs:"ausgaben",opening:"anfangsbestand",reserve:"reserve",personal:"privat",charity:"feuerwehr"};
      const input:any={period:i.options.getString("zeitraum")};
      for(const [key,option]of Object.entries(mapping)) input[key]=i.options.getNumber(option)??0;
      const data=financeReport(input), draft=this.state.draft("finance",member.id,data);
      await this.send(i,"GoR · Private Finanzbericht-Vorschau",this.financeText(data)+"\n\nNur bestätigen, wenn die Zuordnung stimmt. Veröffentlichung in der abrufbaren Finanzübersicht; kein Einzelzahlungszugriff.",[row(button("gor44:finance:confirm:"+draft.id,"Bericht veröffentlichen",ButtonStyle.Success),button("gor44:draft:cancel:"+draft.id,"Verwerfen"))]); return;
    }
    const last=this.ctx.store.db.query("SELECT period,payload,created FROM finance_reports_v44 ORDER BY id DESC LIMIT 1").get() as any;
    await this.send(i,"GoR · Geprüfter Finanzbericht",last?this.financeText(JSON.parse(last.payload))+`\n\nFreigegeben <t:${Math.floor(last.created)}:f>.`:"Es wurde noch kein geprüfter Bericht veröffentlicht. Network, persönliche Aufrufe und Feuerwehrweitergaben werden getrennt ausgewiesen. Aktuelle Angaben bitte bei der Finanzzuständigkeit erfragen.");
  }
  async events(i:any,member:GuildMember) {
    const action=i.options?.getString("aktion")||"anzeigen", guild=member.guild;
    if(action!=="anzeigen" && !this.eventTeam(member)) throw new PublicError("Veranstaltungen plant das Eventteam oder die Leitung.");
    if(action==="planen") {
      const payload=eventDraft({title:i.options.getString("titel")||"",start:i.options.getString("beginn")||"",minutes:i.options.getInteger("dauer")||60,
        location:i.options.getString("ort")||"",description:i.options.getString("beschreibung")||"Gemeinsame Veranstaltung von GoR Network."});
      const d=this.state.draft("event",member.id,payload);
      await this.send(i,"GoR · Private Veranstaltungsvorschau",`**${escapeMarkdown(payload.name)}**\n<t:${Math.floor(payload.scheduledStartTime/1000)}:F> bis <t:${Math.floor(payload.scheduledEndTime/1000)}:t>\nTreffpunkt: ${escapeMarkdown(payload.entityMetadata.location)}\n\n${escapeMarkdown(payload.description)}\n\nNach Bestätigung erscheint die native Veranstaltung. Keine automatische Anmeldung und keine Werbe-DMs.`,[row(button("gor44:event:confirm:"+d.id,"Veranstaltung anlegen",ButtonStyle.Success),button("gor44:draft:cancel:"+d.id,"Verwerfen"))]);return;
    }
    if(action==="zuordnen") {
      own(member); const id=i.options.getString("vorgang"), event=i.options.getString("event");
      if(!id || !event) throw new PublicError("Bitte den unklaren Vorgang und die vorhandene Veranstaltungs-ID angeben.");
      const actual=await recoverEvent(this.state,guild,id,snowflake(event),this.ctx.application);
      await this.send(i,"GoR · Veranstaltung bestätigt",`Bestehenden Eintrag bestätigt: ${actual.url}`);return;
    }
    if(action==="absagen") {
      const id=i.options.getString("event");if(!id)throw new PublicError("Bitte die konkrete Veranstaltungs-ID angeben.");
      const managed=this.ctx.store.db.query("SELECT id FROM drafts_v44 WHERE kind='event' AND result_id=? AND state='done'").get(snowflake(id));
      if(!managed)throw new PublicError("Diese Veranstaltung wurde nicht über den GoR-Planungsweg bestätigt.");
      const actual=await guild.scheduledEvents.fetch({guildScheduledEvent:id,force:true});
      if(actual.creatorId!==this.ctx.application || actual.status!==GuildScheduledEventStatus.Scheduled)throw new PublicError("Die Veranstaltung kann über diesen Weg nicht abgesagt werden.");
      const d=this.state.draft("event_cancel",member.id,{id,name:actual.name,start:actual.scheduledStartTimestamp});
      await this.send(i,"GoR · Absage prüfen",`Soll **${escapeMarkdown(actual.name)}** abgesagt werden?`,[row(button("gor44:event:cancel:"+d.id,"Veranstaltung absagen",ButtonStyle.Danger),button("gor44:draft:cancel:"+d.id,"Verwerfen"))]);return;
    }
    const all=await guild.scheduledEvents.fetch(), visible=[];
    for(const e of all.values()) {
      if([GuildScheduledEventStatus.Completed,GuildScheduledEventStatus.Canceled].includes(e.status))continue;
      if(e.channelId) {
        const c=await guild.channels.fetch(e.channelId);
        if(!c || !c.permissionsFor(guild.roles.everyone)?.has(P.ViewChannel) || !c.permissionsFor(member)?.has(P.ViewChannel))continue;
      }
      visible.push(e);
    }
    visible.sort((a,b)=>(a.scheduledStartTimestamp||0)-(b.scheduledStartTimestamp||0));
    await this.send(i,"GoR · Gemeinsam etwas erleben",visible.length?visible.slice(0,8).map(e=>`**${escapeMarkdown(e.name)}**\n<t:${Math.floor((e.scheduledStartTimestamp||0)/1000)}:F> · ${e.url}`).join("\n\n"):"Aktuell sind keine öffentlichen Veranstaltungen eingetragen. Vorschläge kannst du über /ideen einreichen.",[row(button("gor:roles:open:v5","Event-Meldungen selbst wählen"))]);
  }
  async retentionList(i:any,member:GuildMember) {
    own(member); const list=this.state.dueCases();
    const text=list.length?list.slice(0,12).map(c=>`**#${c.id}** · ${c.policy_state==="unclassified"?"Altbestand: Einstufung offen":c.hold_until && c.hold_until>timestamp()?"Begründete Aufbewahrung aktiv":"Einzelprüfung fällig"}${c.delete_after?` · <t:${Math.floor(c.delete_after)}:d>`:""}`).join("\n"):"Aktuell ist keine Fallaufbewahrung zur Prüfung fällig.";
    const controls=list.slice(0,5).map(c=>button(`gor44:retention:${c.policy_state==="unclassified"?"classify":"prepare"}:${c.id}`,`Fall #${c.id} prüfen`));
    await this.send(i,"GoR · Aufbewahrung einzeln prüfen",text+"\n\nEin Fallabschluss löscht keine Daten. Historische Fälle werden zunächst eingestuft; fällige Fallkanäle nur nach konkreter Vorschau und Bestätigung gelöscht.",controls.length?[row(...controls)]:[]);
  }
  async handle(i:any,member:GuildMember):Promise<boolean> {
    const command=i.isChatInputCommand?.()?i.commandName:"", id=i.customId||"", store=this.ctx.store;
    if(command==="team" && i.options.getInteger("aufbewahrung")!==null) {
      own(member);const n=i.options.getInteger("fall"),days=i.options.getInteger("aufbewahrung"),reason=i.options.getString("grund");
      if(!n || !reason)throw new PublicError("Bitte die konkrete Fallnummer und den Aufbewahrungsgrund angeben.");
      this.state.hold(n,days,reason);store.audit(member.id,"retention_hold",String(n));
      await this.send(i,"GoR · Aufbewahrungsausnahme gespeichert",days?`Fall #${n} wird für ${days} Tage von der regulären Löschung ausgenommen. Danach ist die Notwendigkeit erneut zu prüfen.`:`Die zusätzliche Aufbewahrung für Fall #${n} ist beendet. Eine Kanallöschung benötigt weiter eine konkrete Einzelbestätigung.`);return true;
    }
    if(command==="rechtliches" || id==="gor44:legal") { await this.legal(i);return true; }
    if(id==="gor44:status") { await this.status(i);return true; }
    if(id==="gor44:payment" || (i.isStringSelectMenu?.() && id==="gor:kind:v4" && i.values[0]==="zahlung") || id==="gor:case:zahlung") { await this.payment(i);return true; }
    if(command==="meine_daten") {
      const data=this.state.myData(member.id), extra=i.options.getBoolean("download")?{files:[new AttachmentBuilder(Buffer.from(JSON.stringify(data,null,2)),{name:"GoR_meine_Botdaten.json"})]}:{};
      await this.send(i,"GoR · Deine eigenen Botdaten",`**${data.cases.length}** eigene Fälle · **${data.ideas.length}** eigene Vorschläge · **${data.requests.length}** zugeordnete Aufbewahrungsstände\n\nAngezeigt werden höchstens 200 eigene Einträge je Kategorie. Die optionale JSON-Datei enthält keine Bearbeiter-IDs und keine fremden Fallgespräche.\n${data.further_data}\nDie Datenschutzhinweise erreichst du mit /rechtliches.`,[],extra);return true;
    }
    if(id==="gor44:settings:save" && i.isModalSubmit?.()) {
      own(member);const values:any={};for(const key of Object.keys(LEGAL_FIELDS))values[key]=i.fields.getTextInputValue(key);
      saveLegalLinks(store,values);store.audit(member.id,"legal_links_update","v44");
      await this.send(i,"GoR · Kontaktwege gespeichert","Die Links sind gespeichert. Öffne und prüfe die tatsächlichen Seiten, bestätige danach die Informationswege. Das ist eine Betreiberbestätigung und keine juristische Prüfung.",this.settingsButtons());return true;
    }
    if(id==="gor44:settings:review") {
      own(member);const current=this.links();if(current.missing.length || current.invalid.length)throw new PublicError("Zuerst alle fünf gültigen Informations- und Kontaktwege hinterlegen.");
      store.setting("legal_reviewed_v44","true");store.setting("legal_review_digest_v44",legalDigest(current.links));store.audit(member.id,"legal_links_review","v44");
      await this.send(i,"GoR · Informationswege bestätigt","Die hinterlegten Links werden nun in /rechtliches angezeigt. Inhalt, Erreichbarkeit und Aktualität bleiben beim tatsächlichen Betreiber.");return true;
    }
    if(i.isModalSubmit?.() && id.startsWith("gor44:privacy:")) {
      const kind=id.split(":")[2];if(!Object.hasOwn(PRIVACY_KINDS,kind))throw new PublicError("Ungültige Anfrageart.");
      await this.ctx.createCase(i,member,"datenschutz",{summary:PRIVACY_KINDS[kind as keyof typeof PRIVACY_KINDS],details:cleanText(i.fields.getTextInputValue("details"),700),requestType:kind});return true;
    }
    if(i.isModalSubmit?.() && id.startsWith("gor44:complaint:")) {
      const target=id.split(":")[2];await this.ctx.createCase(i,member,"beschwerde",{summary:cleanText(i.fields.getTextInputValue("summary"),100),details:cleanText(i.fields.getTextInputValue("details"),1000),excluded:target==="none"?[]:[snowflake(target)]});return true;
    }
    if(i.isModalSubmit?.() && id.startsWith("gor44:appeal:")) {
      const related=Number(id.split(":")[2]);let excluded:string[]=[];
      if(related) {const c=store.get(related);if(c.opener_id!==member.id)throw new PublicError("Du kannst über diesen Weg nur einen eigenen Fall prüfen lassen.");excluded=c.assignee_id?[c.assignee_id]:[];}
      await this.ctx.createCase(i,member,"einspruch",{summary:cleanText(i.fields.getTextInputValue("summary"),100),details:cleanText(i.fields.getTextInputValue("details"),1000),relatedCase:related||undefined,excluded});return true;
    }
    if(i.isModalSubmit?.() && id==="gor44:idea:new") {
      const n=this.state.createIdea(member.id,i.fields.getTextInputValue("title"),i.fields.getTextInputValue("body"));store.audit(member.id,"idea_create",String(n));
      await this.send(i,"GoR · Deine Idee ist eingegangen",`Öffentlicher Vorschlag **#${n}** wurde gespeichert. Den nachvollziehbaren Stand findest du mit /ideen.`);return true;
    }
    if(command==="ideen" || id==="gor44:ideas") {await this.ideas(i,member);return true;}
    if(command==="events" || id==="gor44:events") {await this.events(i,member);return true;}
    if(command==="finanzbericht" || id==="gor44:finance") {await this.financeView(i,member);return true;}
    if(id.startsWith("gor44:finance:confirm:")) {
      if(!this.finance(member))throw new PublicError("Die Finanzzuständigkeit ist nicht mehr vorhanden.");
      await this.ctx.serial(async()=>{const draftId=id.split(":")[3];this.state.publishFinance(draftId,member.id);store.audit(member.id,"finance_publish",draftId);});
      await this.send(i,"GoR · Finanzbericht freigegeben","Der geprüfte Bericht ist jetzt mit /finanzbericht abrufbar. Es wurden keine Zahlungsdaten abgefragt oder Zahlungen ausgelöst.");return true;
    }
    if(id.startsWith("gor44:event:confirm:")) {
      if(!this.eventTeam(member))throw new PublicError("Die Veranstaltungszuständigkeit ist nicht mehr vorhanden.");
      const event=await this.ctx.serial(()=>publishEvent(this.state,member.guild,id.split(":")[3],member.id,this.ctx.application));
      store.audit(member.id,"event_create",event.id);await this.send(i,"GoR · Veranstaltung geplant",`Der bestätigte Termin: ${event.url}`);return true;
    }
    if(id.startsWith("gor44:event:cancel:")) {
      if(!this.eventTeam(member))throw new PublicError("Die Veranstaltungszuständigkeit ist nicht mehr vorhanden.");
      await this.ctx.serial(async()=>{const d=this.state.inspectDraft(id.split(":")[3],"event_cancel",member.id),e=await member.guild.scheduledEvents.fetch({guildScheduledEvent:d.payload.id,force:true});
        if(e.creatorId!==this.ctx.application || e.name!==d.payload.name || e.scheduledStartTimestamp!==d.payload.start || e.status!==GuildScheduledEventStatus.Scheduled)throw new PublicError("Der Termin wurde inzwischen geändert. Bitte neu prüfen.");
        this.state.claimDraft(d.id,"event_cancel",member.id);try{await e.setStatus(GuildScheduledEventStatus.Canceled);const check=await member.guild.scheduledEvents.fetch({guildScheduledEvent:e.id,force:true});
          if(check.status!==GuildScheduledEventStatus.Canceled)throw new PublicError("Die Absage ist noch nicht bestätigt.");this.state.finishDraft(d.id,"done",e.id);}
        catch{this.state.finishDraft(d.id,"review",e.id);throw new PublicError("Die Absage muss am vorhandenen Termin geprüft werden. Nicht erneut planen.");}});
      await this.send(i,"GoR · Veranstaltung abgesagt","Die Absage wurde von Discord bestätigt.");return true;
    }
    if(id.startsWith("gor44:draft:cancel:")) {
      const draftId=id.split(":")[3], d=store.db.query("SELECT kind FROM drafts_v44 WHERE id=? AND actor_id=? AND state='draft'").get(draftId,member.id) as any;
      if(!d)throw new PublicError("Diese Vorschau gehört dir nicht oder ist bereits abgeschlossen.");
      this.state.inspectDraft(draftId,d.kind,member.id);this.state.finishDraft(draftId,"cancelled");await this.send(i,"GoR · Vorschau verworfen","Der Entwurf wurde nicht angewendet.");return true;
    }
    if(id==="gor44:retention:list") {await this.retentionList(i,member);return true;}
    if(/^gor44:retention:(classify|prepare):\d+$/.test(id)) {
      own(member);const [, ,action,n]=id.split(":"),number=Number(n);
      if(action==="classify") {this.state.classify(number);store.audit(member.id,"retention_classify",n);await this.send(i,"GoR · Altfall eingestuft",`Fall #${n} hat ab heute einen vorläufigen 30-Tage-Prüftermin. Es wurde kein Kanal gelöscht.`);return true;}
      const d=await this.retention.prepare(member.guild,number,member.id);
      const absent=d.kind==="retention_recover";
      await this.send(i,absent?"GoR · Fehlenden Fallkanal bestätigen":"GoR · Endgültige Kanallöschung prüfen",`**Fall #${number} · Kanal-ID ${d.payload.channel_id}**\nDer geschlossene Fall ist zur Prüfung fällig und hat keine aktive Aufbewahrungsausnahme.\n\n${absent?"Discord meldet genau diesen gespeicherten Kanal als nicht vorhanden. Die Bestätigung prüft dies erneut und übernimmt den Löschstand; es wird kein weiterer Kanal gelöscht.":"Die Bestätigung löscht genau diesen Fallkanal endgültig. Eine Container-Rücksicherung stellt Discord-Nachrichten nicht wieder her."} Metadaten werden getrennt nach ihrem Ablauf behandelt.`,[row(button("gor44:retention:confirm:"+d.id,absent?"Fehlenden Kanal bestätigen":"Diesen Fallkanal endgültig löschen",ButtonStyle.Danger),button("gor44:draft:cancel:"+d.id,"Verwerfen"))]);return true;
    }
    if(id.startsWith("gor44:retention:confirm:")) {
      own(member);const number=await this.ctx.serial(()=>this.retention.apply(member.guild,id.split(":")[3],member.id));store.audit(member.id,"case_channel_delete",String(number));
      await this.send(i,"GoR · Fallkanal gelöscht",`Die Löschung von Fall #${number} wurde bestätigt. Personenbezogene Metadaten werden nach ihrer eigenen Frist und ohne aktive Aufbewahrungsausnahme entfernt.`);return true;
    }
    if(command==="update_vorschau") {
      own(member);const plan=await captureChangePlan(member.guild,this.ctx.maps,store,this.ctx.application,this.ctx.version,this.publicLinks()),d=this.state.draft("update",member.id,plan);
      await this.send(i,"GoR · Konkrete Änderungsvorschau",plan.scope+`\n\n**Erkannte Änderungen / Prüfpunkte: ${plan.summary.length}**\n`+(plan.summary.slice(0,12).map(v=>"• "+v).join("\n")||"Verwaltete Gestaltung, Bereichsrechte und Infotafeln sind bereits passend. Reihenfolge und native Einstellungen gehören zusätzlich zum ausdrücklich genannten Abgleich.")+`\n\nDie vollständige Liste steht in der beigefügten Datei. Vorgang: \`${d.id}\`\n15 Minuten gültig. Jede Änderung am geprüften Stand macht die Vorschau ungültig.`,[row(button("gor44:update:apply:"+d.id,"Diesen Abgleich anwenden",ButtonStyle.Success),button("gor44:draft:cancel:"+d.id,"Verwerfen"))],{files:[new AttachmentBuilder(Buffer.from(`${plan.scope}\n\n${plan.summary.join("\n")||"Keine Abweichungen an Gestaltung, Bereichsrechten oder Infotafeln."}\n\nGeschützte Felder: ${Object.keys(protections(store)).join(", ")||"keine"}\n\nVorgang: ${d.id}`),{name:"GoR_Aenderungsplan.txt"})]});return true;
    }
    if(command==="update_anwenden" || id.startsWith("gor44:update:apply:")) {
      own(member);const draftId=command?i.options.getString("vorgang",true):id.split(":")[3];let claimed=false;
      const result=await this.ctx.applySetup(async()=>{
        const d=this.state.inspectDraft(draftId,"update",member.id),fresh=await captureChangePlan(member.guild,this.ctx.maps,store,this.ctx.application,this.ctx.version,this.publicLinks());
        if(d.payload.fingerprint!==fresh.fingerprint || d.payload.configuration!==fresh.configuration)throw new PublicError("Server oder Konfiguration wurden seit der Vorschau geändert. Bitte /update_vorschau erneut öffnen.");
        this.state.claimDraft(draftId,"update",member.id);claimed=true;
      }).catch(error=>{if(claimed)this.state.finishDraft(draftId,"review");throw error;});
      if(!result)throw new PublicError("Eine Einrichtung läuft bereits. Die Vorschau wurde nicht angewendet.");
      this.state.finishDraft(draftId,result.issues.length?"review":"done");store.audit(member.id,"layout_preview_apply",draftId);
      await this.send(i,"GoR · Abgleich abgeschlossen",`${result.created} angelegt · ${result.updated} aktualisiert · ${result.issues.length} Punkte offen.\n/einrichtung zeigt die tatsächlichen Ergebnisse.`);return true;
    }
    return false;
  }
}

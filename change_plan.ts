import { createHash } from "node:crypto";
import type { Guild } from "discord.js";
import { LAYOUT } from "./server_blueprint";
import { MESSAGE_KEYS, setupMessage } from "./server_content";
import type { SetupMaps, SetupStorage } from "./auto_setup";
import type { LegalLinks } from "./legal_config";
import { PublicError, timestamp } from "./feature_base";
import { overwriteShape, profileOverwrites, MOD } from "./setup_permissions";
import { sameCommunityPanel } from "./community_ui";

export function digest(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
export function protections(storage: SetupStorage, at=timestamp()): Record<string,number> {
  let raw: any={}; try { raw=JSON.parse(storage.setting("layout_protections_v44")||"{}"); } catch {}
  return Object.fromEntries(Object.entries(raw).filter(([,until])=>typeof until==="number" && until>at)) as Record<string,number>;
}
export function protectedField(storage: SetupStorage,key: string,field: string) { return !!protections(storage)[key+":"+field]; }
export function setProtection(storage: SetupStorage, key: string, hours: number) {
  const [kind,name,field]=key.split(":"), role=LAYOUT.roles.some(r=>r.key===name), category=LAYOUT.categories.some(c=>c.key===name);
  const channel=LAYOUT.categories.some(c=>c.channels.some(ch=>ch.key===name));
  const allowed=kind==="role" && role && ["name","color","hoist"].includes(field)
    || kind==="category" && category && field==="name" || kind==="channel" && channel && ["name","topic","rateLimitPerUser"].includes(field)
    || key==="guild:profile:name" || key==="guild:profile:description";
  if (!allowed || key.split(":").length!==3 || !Number.isSafeInteger(hours) || hours<0 || hours>168)
    throw new PublicError("Geschützt werden können bekannte Namen, Farben und Kanaltexte für 0 bis 168 Stunden. Rechte und Rollenwahl bleiben geprüft.");
  const all=protections(storage); if (hours) all[key]=timestamp()+hours*3600; else delete all[key];
  storage.setting("layout_protections_v44",JSON.stringify(all)); return all;
}
function roleShape(r: any) { return { id:r.id,name:r.name,color:r.color,hoist:r.hoist,mentionable:r.mentionable,managed:r.managed,position:r.position,permissions:String(r.permissions.bitfield) }; }
function channelShape(c: any) { return { id:c.id,name:c.name,type:c.type,parent:c.parentId,topic:c.topic,slowmode:c.rateLimitPerUser,position:c.rawPosition,
  overwrites:[...(c.permissionOverwrites?.cache.values()||[])].map((o:any)=>[o.id,o.type,String(o.allow.bitfield),String(o.deny.bitfield)]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))) }; }
export async function captureChangePlan(guild: Guild, maps: SetupMaps, storage: SetupStorage, application: string, version: string, links: LegalLinks={}) {
  const [roles,channels]=await Promise.all([guild.roles.fetch(),guild.channels.fetch()]);
  const profile=typeof guild.fetch==="function" ? await guild.fetch() : guild;
  const summary: string[]=[];
  for (const spec of LAYOUT.roles) {
    const actual=roles.get(maps.roles[spec.key]);
    if (!actual) summary.push(`Rolle ergänzen: ${spec.name}`);
    else {
      const fields:string[]=[];
      if(!protectedField(storage,"role:"+spec.key,"name") && actual.name!==spec.name)fields.push("Name");
      if(!protectedField(storage,"role:"+spec.key,"color") && actual.color!==spec.color)fields.push("Farbe");
      if(!protectedField(storage,"role:"+spec.key,"hoist") && actual.hoist!==spec.hoist)fields.push("Hervorhebung");
      if(actual.mentionable)fields.push("Erwähnbarkeit deaktivieren");
      if((spec.selfAssignable && actual.permissions.bitfield!==0n) || (["networkleitung","communityleitung","moderation"].includes(spec.key) && (actual.permissions.bitfield & MOD)!==MOD))fields.push("Rollenrechte");
      if(fields.length)summary.push(`Rolle ${spec.name}: ${fields.join(", ")}`);
    }
  }
  for (const category of LAYOUT.categories) for (const spec of [category,...category.channels]) {
    const cat=spec===category, key=(cat?"category:":"channel:")+spec.key;
    const actual:any=channels.get((cat?maps.categories:maps.channels)[spec.key]);
    if (!actual) summary.push(`Bereich ergänzen: ${spec.name}`);
    else {
      const fields:string[]=[];
      if(!protectedField(storage,key,"name") && actual.name!==spec.name)fields.push("Name");
      if(!cat && actual.parentId!==maps.categories[category.key])fields.push("Kategoriezuordnung");
      if("type" in spec && spec.type==="text") {
        if(!protectedField(storage,key,"topic") && actual.topic!==spec.topic)fields.push("Thema");
        if(!protectedField(storage,key,"rateLimitPerUser") && actual.rateLimitPerUser!==spec.slowmode)fields.push("Schreibpause");
      }
      try{const wanted=profileOverwrites(spec.profile,guild.id,application,maps.roles,new Set(roles.keys()));
        if(overwriteShape(actual.permissionOverwrites.cache.values())!==overwriteShape(wanted))fields.push("Kanalrechte nach Profil "+spec.profile);}
      catch{fields.push("Rechteprofil nach Anlage fehlender Rollen prüfen");}
      if(fields.length)summary.push(`Bereich ${spec.name}: ${fields.join(", ")}`);
    }
  }
  const panels: any[]=[];
  for (const key of MESSAGE_KEYS) {
    const channel:any=channels.get(maps.channels[key]);
    const row=storage.db.query("SELECT id FROM managed_resources WHERE key=?").get("message:"+key) as any;
    const saved=row?.id || (key==="start"?storage.setting("community_panel_message_id"):key==="support"?storage.setting("panel_message_id"):null);
    if (!saved || saved==="pending" || !channel?.messages) { panels.push({key,state:saved==="pending"?"review":"not_bound"});summary.push(`Infotafel ${key}: ${saved==="pending"?"unklare Anlage zuerst prüfen":"bestehenden Eintrag suchen oder nach bestätigter Prüfung ergänzen"}`); continue; }
    try {
      const message=await channel.messages.fetch({message:saved,force:true});
      if (message.author.id!==application) throw new PublicError("Eine gespeicherte Infotafel gehört nicht zur GoR-App.");
      if(!sameCommunityPanel(message,setupMessage(key,maps.channels,links),application))summary.push(`Eigene Infotafel ${key}: Text, Darstellung oder Schaltflächen aktualisieren`);
      panels.push({key,id:message.id,content:message.content,embeds:message.embeds.map((e:any)=>e.toJSON?.()||e),components:message.components.map((c:any)=>c.toJSON?.()||c)});
    } catch (error:any) { if (error?.code===10008 || error?.status===404) {panels.push({key,state:"missing"});summary.push(`Infotafel ${key}: gespeicherten Eintrag und Wiederaufnahme prüfen`);} else throw error; }
  }
  // Native configuration is included so the same preview cannot silently apply over later human edits.
  const [onboarding,automod]=await Promise.all([guild.fetchOnboarding(),guild.autoModerationRules.fetch()]);
  const native={onboarding:onboarding.toJSON?.()||onboarding,automod:[...automod.values()].map(r=>r.toJSON()).sort((a:any,b:any)=>a.id.localeCompare(b.id))};
  const live={roles:[...roles.values()].map(roleShape).sort((a,b)=>a.id.localeCompare(b.id)),channels:[...channels.values()].filter(Boolean).map(channelShape).sort((a,b)=>a.id.localeCompare(b.id)),
    profile:{id:profile.id,name:profile.name,description:profile.description,features:[...profile.features].sort(),rules:profile.rulesChannelId,updates:profile.publicUpdatesChannelId,
      afk:profile.afkChannelId,afkTimeout:profile.afkTimeout,system:profile.systemChannelId,locale:profile.preferredLocale,
      notifications:profile.defaultMessageNotifications,verification:profile.verificationLevel,filter:profile.explicitContentFilter},panels,native};
  const configuration={version,layout:LAYOUT,maps,protections:protections(storage),links,panels:MESSAGE_KEYS.map(key=>setupMessage(key,maps.channels,links))};
  return { fingerprint:digest(live),configuration:digest(configuration),summary,
    scope:"Vollständiger GoR-Abgleich: 16 Rollen, 10 Kategorien, 41 Kanäle, 11 eigene Infotafeln, Bereichsrechte, Reihenfolge, Community-Profil, native Auswahlfragen und Erwähnungsschutz. Zusätzliche Bereiche und Fallkanäle bleiben erhalten." };
}

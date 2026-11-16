import { GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel } from "discord.js";
import { CommunityState } from "./community_state";
import { PublicError, cents, cleanText, timestamp } from "./feature_base";

export type FinanceReport = { period:string; received:number; refunds:number; fees:number; costs:number; opening:number; reserve:number; personal:number; charity:number };
export function financeReport(input: Record<string,unknown>): FinanceReport {
  if (typeof input.period!=="string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(input.period)) throw new PublicError("Bitte den Berichtsmonat als YYYY-MM angeben.");
  const data:any={period:input.period};
  for(const key of ["received","refunds","fees","costs","opening","reserve","personal","charity"])
    data[key]=cents(typeof input[key]==="number" ? input[key] as number : NaN);
  if (data.opening+data.received-data.refunds-data.fees-data.costs-data.charity < data.reserve)
    throw new PublicError("Die Rücklage ist höher als der ausgewiesene verbleibende Bestand. Anfangsbestand und Ausgänge prüfen.");
  return data as FinanceReport;
}
export function financeBalance(r: FinanceReport) { return r.opening+r.received-r.refunds-r.fees-r.costs-r.charity; }
export function eventDraft(input: {title:string;start:string;minutes:number;location:string;description:string},at=timestamp()) {
  const parts=/^(\d{4})-(\d{2})-(\d{2})T(\d\d):(\d\d)(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.exec(input.start);
  if (!parts) throw new PublicError("Der Beginn benötigt eine Zeitzone, z. B. 2026-11-21T19:00+01:00.");
  const [,year,month,day,hour,minute]=parts;
  if(Number(month)<1 || Number(month)>12 || Number(day)<1 || Number(day)>new Date(Date.UTC(Number(year),Number(month),0)).getUTCDate() || Number(hour)>23 || Number(minute)>59)
    throw new PublicError("Bitte ein tatsächlich gültiges Kalenderdatum und eine gültige Uhrzeit angeben.");
  const start=Date.parse(input.start);
  if (!Number.isFinite(start) || start<=at*1000+60_000 || start>at*1000+366*86400_000 || !Number.isSafeInteger(input.minutes) || input.minutes<5 || input.minutes>1440)
    throw new PublicError("Bitte einen zukünftigen Beginn und eine Dauer zwischen 5 und 1440 Minuten wählen.");
  return { name:cleanText(input.title,100,"Titel"),description:cleanText(input.description,900,"Beschreibung"),
    scheduledStartTime:start,scheduledEndTime:start+input.minutes*60_000,entityType:GuildScheduledEventEntityType.External,
    privacyLevel:GuildScheduledEventPrivacyLevel.GuildOnly,entityMetadata:{location:cleanText(input.location,100,"Treffpunkt")} };
}
export function sameEvent(got:any,wanted:any) {
  return got?.name===wanted.name && got.description===wanted.description && got.scheduledStartTimestamp===wanted.scheduledStartTime
    && got.scheduledEndTimestamp===wanted.scheduledEndTime && got.entityType===wanted.entityType && got.privacyLevel===wanted.privacyLevel && got.entityMetadata?.location===wanted.entityMetadata.location;
}
export async function publishEvent(state:CommunityState,guild:any,id:string,actor:string,application:string) {
  const checked=state.inspectDraft(id,"event",actor);
  if(checked.payload.scheduledStartTime<=Date.now()+60_000)throw new PublicError("Der Veranstaltungsbeginn liegt zu nahe oder ist bereits vorbei. Bitte neu planen.");
  const draft=state.claimDraft(id,"event",actor), payload=draft.payload;
  try {
    const event=await guild.scheduledEvents.create({...payload,reason:"GoR: bestätigte Veranstaltungsplanung"});
    state.db.query("UPDATE drafts_v44 SET result_id=? WHERE id=?").run(event.id,id);
    const actual=await guild.scheduledEvents.fetch({guildScheduledEvent:event.id,force:true});
    if (actual.creatorId!==application || !sameEvent(actual,payload)) throw new PublicError("Discord bestätigt die Veranstaltung noch nicht vollständig.");
    state.finishDraft(id,"done",event.id); return actual;
  } catch { state.finishDraft(id,"review"); throw new PublicError("Die Veranstaltungsanlage ist unklar. Nicht erneut erstellen; die Leitung kann den vorhandenen Eintrag mit /events zuordnen."); }
}
export async function recoverEvent(state:CommunityState,guild:any,id:string,eventId:string,application:string) {
  const row=state.db.query("SELECT * FROM drafts_v44 WHERE id=? AND kind='event' AND state='review'").get(id) as any;
  if (!row) throw new PublicError("Es gibt keinen passenden unklaren Veranstaltungsvorgang.");
  if (row.result_id && row.result_id!==eventId) throw new PublicError("Die Veranstaltungs-ID passt nicht zum Vorgang.");
  const actual=await guild.scheduledEvents.fetch({guildScheduledEvent:eventId,force:true});
  if (actual.creatorId!==application || !sameEvent(actual,JSON.parse(row.payload))) throw new PublicError("Veranstaltung, Ersteller und geplante Angaben stimmen nicht überein.");
  state.finishDraft(id,"done",eventId); return actual;
}

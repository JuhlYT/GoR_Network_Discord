import { existsSync, readFileSync, chmodSync, openSync, closeSync, fsyncSync, writeSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { Database } from "bun:sqlite";
import { CommunityState, type CaseRecord } from "./community_state";
import { DAY, PublicError, timestamp } from "./feature_base";

type StoreLike = { db: Database; directory: string; setting(key: string, value?: string): string | undefined; get(id: number): CaseRecord };
export class ErasureLedger {
  readonly file: string;
  constructor(readonly store: StoreLike) { this.file = join(store.directory, "erasure-ledger.jsonl"); }
  entries() {
    if (!existsSync(this.file)) return [] as { case_id: number; at: number }[];
    const text = readFileSync(this.file, "utf8");
    if (Buffer.byteLength(text) > 8 * 1024 * 1024) throw new PublicError("Das Löschjournal muss vor der Fortsetzung geprüft werden.");
    return text.split("\n").filter(Boolean).map(line => {
      let value: any; try { value = JSON.parse(line); } catch { throw new PublicError("Das Löschjournal ist unvollständig. Wiederherstellung zuerst prüfen."); }
      if (!Number.isSafeInteger(value.case_id) || value.case_id < 1 || !Number.isFinite(value.at)) throw new PublicError("Das Löschjournal ist ungültig.");
      return { case_id: value.case_id as number, at: value.at as number };
    });
  }
  record(id: number, at = timestamp()) {
    const fd = openSync(this.file, "a", 0o600);
    try { writeSync(fd, JSON.stringify({ case_id: id, at }) + "\n"); fsyncSync(fd); } finally { closeSync(fd); }
    chmodSync(this.file, 0o600);
    const highFile=join(this.store.directory,"erasure-highwater.txt");
    let high=0;try{high=Number(readFileSync(highFile,"utf8"));}catch{}
    writeFileSync(highFile+".tmp",String(Math.max(id,high||0)),{mode:0o600});renameSync(highFile+".tmp",highFile);
  }
  eraseMetadata(id: number, at: number) {
    this.store.db.transaction(() => {
      const c=this.store.db.query("SELECT guild_id FROM cases WHERE id=?").get(id) as any;
      if(c && c.guild_id!==this.store.setting("bound_guild_v44"))throw new PublicError("Ein Löschjournaleintrag passt nicht zum Zielserver.");
      this.store.db.query("UPDATE cases SET opener_id='removed',assignee_id=NULL,channel_id=NULL,status='closed' WHERE id=?").run(id);
      this.store.db.query("UPDATE case_policy_v44 SET excluded='[]',request_type='',related_case=NULL,due=NULL,hold_reason=NULL,delete_token=NULL,state='erased',erased_at=? WHERE case_id=?").run(at,id);
      this.store.db.query("DELETE FROM project_reviews WHERE case_id=?").run(id);
      this.store.db.query("DELETE FROM project_checks_v44 WHERE case_id=?").run(id);
      this.store.db.query("UPDATE audit SET actor_id='removed' WHERE resource=? AND action LIKE 'case_%'").run(String(id));
      const high = Math.max(id, Number(this.store.setting("case_id_highwater") || 0));
      this.store.setting("case_id_highwater", String(high));
    }).immediate();
  }
  replay() {
    const highFile=join(this.store.directory,"erasure-highwater.txt");
    if(existsSync(highFile)){
      const high=Number(readFileSync(highFile,"utf8"));if(!Number.isSafeInteger(high)||high<0)throw new PublicError("Der Fallnummernstand muss vor der Rücksicherung geprüft werden.");
      this.store.setting("case_id_highwater",String(Math.max(high,Number(this.store.setting("case_id_highwater")||0))));
    }
    for (const item of this.entries()) this.eraseMetadata(item.case_id,item.at);
  }
  compact(at=timestamp()) {
    const entries=this.entries(),kept=entries.filter(item=>item.at>=at-37*DAY);
    if(!existsSync(this.file))return;
    const high=Math.max(Number(this.store.setting("case_id_highwater")||0),...entries.map(item=>item.case_id));
    const highFile=join(this.store.directory,"erasure-highwater.txt");
    writeFileSync(highFile+".tmp",String(high),{mode:0o600});renameSync(highFile+".tmp",highFile);
    writeFileSync(this.file+".tmp",kept.map(v=>JSON.stringify(v)+"\n").join(""),{mode:0o600});renameSync(this.file+".tmp",this.file);
  }
  export() { return { format: 1, highwater: Number(this.store.setting("case_id_highwater") || 0), entries: this.entries() }; }
}
export function channelFingerprint(channel: any) {
  const overwrites = [...channel.permissionOverwrites.cache.values()].map((o: any) => [o.id,o.type,String(o.allow.bitfield),String(o.deny.bitfield)])
    .sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
  return createHash("sha256").update(JSON.stringify([channel.id,channel.guild.id,channel.type,channel.parentId,channel.name,channel.topic,channel.lastMessageId,overwrites])).digest("hex");
}
export class Retention {
  readonly ledger: ErasureLedger;
  constructor(readonly store: StoreLike, readonly state: CommunityState, readonly validateChannel: (guild: any, c: CaseRecord) => Promise<any>) {
    const bound=store.setting("bound_guild_v44");if(bound && bound!==state.guild)throw new PublicError("Das Datenverzeichnis gehört zu einem anderen Zielserver.");
    store.setting("bound_guild_v44",state.guild);
    this.ledger = new ErasureLedger(store); this.ledger.replay();
  }
  async prepare(guild: any, id: number, actor: string) {
    const c = this.store.get(id);
    if (!this.state.canDelete(c)) throw new PublicError("Der Fall ist noch nicht zur Löschung fällig, nicht eingestuft oder wird noch aufbewahrt.");
    if (!c.channel_id) throw new PublicError("Die Kanalzuordnung muss zuerst geprüft werden.");
    let channel:any;
    try{channel=await this.validateChannel(guild,c);}
    catch(error:any){if(error?.code===10003 || error?.status===404)return this.state.draft("retention_recover",actor,{id:c.id,channel_id:c.channel_id,fingerprint:""});throw error;}
    return this.state.draft("retention",actor,{ id:c.id,channel_id:channel.id,fingerprint:channelFingerprint(channel) });
  }
  async apply(guild: any, draftId: string, actor: string) {
    const pending=this.store.db.query("SELECT kind FROM drafts_v44 WHERE id=? AND actor_id=?").get(draftId,actor) as any;
    if(pending?.kind==="retention_recover") {
      const d=this.state.inspectDraft(draftId,"retention_recover",actor),c=this.store.get(d.payload.id);
      if(!this.state.canDelete(c) || c.channel_id!==d.payload.channel_id)throw new PublicError("Die Fallzuordnung oder Aufbewahrung hat sich geändert.");
      try{if(await guild.channels.fetch(c.channel_id,{force:true}))throw new PublicError("Der Kanal ist vorhanden. Bitte eine neue konkrete Löschvorschau erstellen.");}
      catch(error:any){if(error?.code!==10003 && error?.status!==404)throw error;}
      this.state.claimDraft(draftId,"retention_recover",actor);
      this.store.db.query("UPDATE case_policy_v44 SET state='channel_deleted',channel_deleted=? WHERE case_id=?").run(timestamp(),c.id);
      this.state.finishDraft(draftId,"done");return c.id;
    }
    const preview = this.state.inspectDraft(draftId,"retention",actor), c = this.store.get(preview.payload.id);
    if (!this.state.canDelete(c) || c.channel_id !== preview.payload.channel_id) throw new PublicError("Die Aufbewahrung oder Kanalzuordnung hat sich geändert. Bitte neu prüfen.");
    const channel = await this.validateChannel(guild,c);
    if (channelFingerprint(channel) !== preview.payload.fingerprint) throw new PublicError("Der Kanal wurde seit der Vorschau geändert. Bitte eine neue Vorschau erstellen.");
    const draft = this.state.claimDraft(draftId,"retention",actor);
    this.store.db.query("UPDATE case_policy_v44 SET state='deleting',delete_token=? WHERE case_id=?").run(draft.id,c.id);
    try {
      try { await channel.delete("GoR: einzeln geprüfter Ablauf der Fallaufbewahrung"); }
      catch (error: any) {
        // A lost DELETE response is resolved by reading the exact channel, never by another blind DELETE.
        try { const present=await guild.channels.fetch(c.channel_id,{ force:true }); if(present)throw new PublicError("Die Löschung ist noch nicht bestätigt. Den vorhandenen Fall zuerst prüfen."); }
        catch (check: any) { if (check?.code !== 10003 && check?.status !== 404) throw check; }
      }
      try {
        const current = await guild.channels.fetch(c.channel_id,{ force:true });
        if (current) throw new PublicError("Discord bestätigt die Kanallöschung noch nicht.");
      } catch (error: any) { if (error?.code !== 10003 && error?.status !== 404) throw error; }
      this.store.db.query("UPDATE case_policy_v44 SET state='channel_deleted',channel_deleted=? WHERE case_id=?").run(timestamp(),c.id);
      this.state.finishDraft(draft.id,"done");
      return c.id;
    } catch (error) {
      this.store.db.query("UPDATE case_policy_v44 SET state='review' WHERE case_id=?").run(c.id);
      this.state.finishDraft(draft.id,"review"); throw error;
    }
  }
  sweep(at = timestamp()) {
    const rows = this.store.db.query(`SELECT p.case_id FROM case_policy_v44 p JOIN cases c ON p.case_id=c.id
      WHERE c.guild_id=? AND c.status='closed' AND p.state='channel_deleted' AND p.closed_at<=? AND p.erased_at IS NULL
      AND (p.hold_until IS NULL OR p.hold_until<=?)`).all(this.state.guild,at-90*DAY,at) as { case_id:number }[];
    for (const row of rows) { this.ledger.record(row.case_id,at); this.ledger.eraseMetadata(row.case_id,at); }
    this.ledger.compact(at);return rows.length;
  }
}

import { PermissionFlagsBits as P, type Guild, type GuildMember } from "discord.js";
import type { Store } from "./gor_network";
import type { CaseRecord } from "./community_state";

/** Bounded REST audit: role removal must also retire obsolete individual case-channel grants. */
export async function reviewAssignedAccess(guild:Guild,store:Store,application:string,
  canHandle:(c:CaseRecord,m:GuildMember)=>boolean,caseChannel:(guild:Guild,c:CaseRecord)=>Promise<any>) {
  const cursor=Number(store.setting("access_review_cursor_v44")||0);
  const rows=store.db.query(`SELECT * FROM cases WHERE guild_id=? AND assignee_id IS NOT NULL AND channel_id IS NOT NULL
    AND status IN ('open','closed') AND id>? ORDER BY id LIMIT 8`).all(guild.id,cursor) as CaseRecord[];
  if(!rows.length){store.setting("access_review_cursor_v44","0");return;}
  for(const old of rows) {
    const c=store.get(old.id);store.setting("access_review_cursor_v44",String(c.id));
    if(!c.assignee_id || !['open','closed'].includes(c.status))continue;
    let member:GuildMember|null=null;
    try{member=await guild.members.fetch({user:c.assignee_id,force:true});}
    catch(error:any){if(error?.code!==10007){store.audit(application,"access_review",String(c.id),"attention");continue;}}
    if(member && !member.pending && canHandle(c,member))continue;
    const original=c.status;
    try {
      const channel=await caseChannel(guild,c);store.change(c.id,{status:"assigning"});
      if(c.assignee_id!==c.opener_id)await channel.permissionOverwrites.delete(c.assignee_id,"GoR: nicht mehr zuständiger Fallzugriff");
      const verified=await caseChannel(guild,c);
      if(c.assignee_id!==c.opener_id && verified.permissionOverwrites.cache.get(c.assignee_id)?.allow.has(P.ViewChannel))throw new Error("access_not_confirmed");
      const saved=store.change(c.id,{assignee_id:null,status:original});await caseChannel(guild,saved);
      store.audit(application,"case_access_retired",String(c.id));
    } catch(error:any) {
      if(error?.code!==10003 && error?.status!==404){store.change(c.id,{status:"needs_review"});store.audit(application,"access_review",String(c.id),"attention");}
    }
  }
}

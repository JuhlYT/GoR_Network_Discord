import type { Database } from "bun:sqlite";
import { PublicError, DAY, timestamp, addMonth, cleanText, snowflake } from "./feature_base";

export type CaseRecord = { id: number; guild_id: string; opener_id: string; kind: string; channel_id: string | null; assignee_id: string | null; status: string; created: number; updated: number };
export type CasePolicy = { case_id: number; category: string; excluded: string; request_type: string; related_case: number | null;
  due: number | null; closed_at: number | null; delete_after: number | null; hold_until: number | null; hold_reason: string | null;
  state: string; delete_token: string | null; channel_deleted: number | null; erased_at: number | null };
export const IDEA_STATUS = { neu: "Neu", pruefung: "In Prüfung", geplant: "Geplant", umgesetzt: "Umgesetzt", abgelehnt: "Begründet abgelehnt" } as const;
export const PRIVACY_KINDS = { auskunft: "Auskunft", berichtigung: "Berichtigung", loeschung: "Löschung", einschraenkung: "Einschränkung / Widerspruch" } as const;
export type CasePreset = { summary: string; details: string; excluded?: string[]; requestType?: string; relatedCase?: number };

export class CommunityState {
  constructor(readonly db: Database, readonly guild: string) {
    db.exec(`CREATE TABLE IF NOT EXISTS case_policy_v44 (case_id INTEGER PRIMARY KEY, category TEXT NOT NULL, excluded TEXT NOT NULL DEFAULT '[]',
      request_type TEXT NOT NULL DEFAULT '',related_case INTEGER,due REAL,closed_at REAL,delete_after REAL,hold_until REAL,hold_reason TEXT,
      state TEXT NOT NULL DEFAULT 'active',delete_token TEXT,channel_deleted REAL,erased_at REAL);
      CREATE TABLE IF NOT EXISTS ideas_v44 (id INTEGER PRIMARY KEY AUTOINCREMENT,guild_id TEXT NOT NULL,author_id TEXT NOT NULL,title TEXT NOT NULL,
      body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'neu',decision TEXT NOT NULL DEFAULT '',created REAL NOT NULL,updated REAL NOT NULL);
      CREATE TABLE IF NOT EXISTS drafts_v44 (id TEXT PRIMARY KEY,kind TEXT NOT NULL,actor_id TEXT NOT NULL,payload TEXT NOT NULL,
      state TEXT NOT NULL,created REAL NOT NULL,expires REAL NOT NULL,result_id TEXT);
      CREATE TABLE IF NOT EXISTS finance_reports_v44 (id INTEGER PRIMARY KEY AUTOINCREMENT,period TEXT NOT NULL,actor_id TEXT NOT NULL,payload TEXT NOT NULL,created REAL NOT NULL);
      CREATE TABLE IF NOT EXISTS project_checks_v44 (case_id INTEGER PRIMARY KEY,contact_id TEXT NOT NULL,budget INTEGER NOT NULL,agreement TEXT NOT NULL,
      actor_id TEXT NOT NULL,checked_at REAL NOT NULL,pilot_start REAL,pilot_end REAL);
      CREATE INDEX IF NOT EXISTS case_policy_due_v44 ON case_policy_v44(state,delete_after);
      CREATE INDEX IF NOT EXISTS ideas_owner_v44 ON ideas_v44(guild_id,author_id);`);
    // Old cases require classification. A new release must never schedule historic channels for deletion by itself.
    db.query(`INSERT OR IGNORE INTO case_policy_v44(case_id,category,state) SELECT id,kind,'unclassified' FROM cases WHERE guild_id=?`).run(guild);
    db.query("UPDATE drafts_v44 SET state='review' WHERE state='applying'").run();
  }
  policy(id: number): CasePolicy | null { return this.db.query("SELECT * FROM case_policy_v44 WHERE case_id=?").get(id) as CasePolicy | null; }
  open(c: CaseRecord, preset?: CasePreset) {
    const excluded = [...new Set((preset?.excluded || []).map(snowflake))].slice(0, 5);
    if (preset?.requestType && !Object.hasOwn(PRIVACY_KINDS, preset.requestType)) throw new PublicError("Bitte eine gültige Datenschutzanfrage wählen.");
    this.db.query(`INSERT INTO case_policy_v44(case_id,category,excluded,request_type,related_case,due,state) VALUES (?,?,?,?,?,?,'active')`)
      .run(c.id, c.kind, JSON.stringify(excluded), preset?.requestType || "", preset?.relatedCase ?? null, c.kind === "datenschutz" ? addMonth(c.created) : null);
  }
  excluded(id: number, user: string) {
    const row = this.policy(id); if (!row) return false;
    try { return (JSON.parse(row.excluded) as string[]).includes(user); } catch { return true; }
  }
  close(id: number, at = timestamp()) {
    // Only cases created with an explicit 4.4 policy receive the proposed regular review date.
    this.db.query(`UPDATE case_policy_v44 SET closed_at=COALESCE(closed_at,?),delete_after=COALESCE(delete_after,?) WHERE case_id=? AND state='active'`)
      .run(at, at + 30 * DAY, id);
  }
  reopen(id:number) {
    this.db.query("UPDATE case_policy_v44 SET closed_at=NULL,delete_after=NULL WHERE case_id=? AND state='active' AND erased_at IS NULL").run(id);
  }
  classify(id: number, at = timestamp()) {
    const c = this.db.query("SELECT * FROM cases WHERE id=? AND guild_id=?").get(id, this.guild) as CaseRecord | null;
    if (!c || c.status !== "closed") throw new PublicError("Nur ein abgeschlossener Fall kann für die Aufbewahrung eingestuft werden.");
    const row = this.policy(id); if (!row || row.state !== "unclassified") throw new PublicError("Dieser Fall ist bereits eingestuft.");
    this.db.query("UPDATE case_policy_v44 SET state='active',closed_at=?,delete_after=? WHERE case_id=?").run(at, at + 30 * DAY, id);
  }
  dueCases(at = timestamp()) {
    return this.db.query(`SELECT c.*,p.state AS policy_state,p.delete_after,p.hold_until FROM cases c JOIN case_policy_v44 p ON c.id=p.case_id
      WHERE c.guild_id=? AND c.status='closed' AND p.erased_at IS NULL AND (p.state IN ('unclassified','deleting','review') OR p.delete_after<=?)
      ORDER BY CASE WHEN p.state='unclassified' THEN 1 ELSE 0 END,p.delete_after,c.id LIMIT 30`).all(this.guild, at) as (CaseRecord & { policy_state: string; delete_after: number | null; hold_until: number | null })[];
  }
  hold(id: number, days: number, reason: string, at = timestamp()) {
    if (!Number.isSafeInteger(days) || days < 0 || days > 365 || !["laufende_pruefung","rechtliche_sicherung","gesetzliche_aufbewahrung"].includes(reason))
      throw new PublicError("Aufbewahrungsgrund oder Prüffrist sind ungültig.");
    if (!this.policy(id)) throw new PublicError("Fall nicht gefunden.");
    this.db.query("UPDATE case_policy_v44 SET hold_until=?,hold_reason=? WHERE case_id=?").run(days ? at + days * DAY : null, days ? reason : null, id);
  }
  canDelete(c: CaseRecord, at = timestamp()) {
    const p = this.policy(c.id);
    return !!p && c.status === "closed" && ["active","review","deleting"].includes(p.state) && !!p.closed_at && !!p.delete_after
      && p.delete_after <= at && (!p.hold_until || p.hold_until <= at) && !p.channel_deleted && !p.erased_at;
  }
  myData(user: string) {
    const cases = this.db.query(`SELECT id,kind,status,created,updated FROM cases WHERE guild_id=? AND opener_id=? ORDER BY id DESC LIMIT 200`).all(this.guild, user);
    const requests = this.db.query(`SELECT p.case_id,p.request_type,p.due,p.closed_at,p.delete_after,p.state FROM case_policy_v44 p JOIN cases c ON c.id=p.case_id
      WHERE c.guild_id=? AND c.opener_id=? ORDER BY p.case_id DESC LIMIT 200`).all(this.guild, user);
    const ideas = this.db.query("SELECT id,title,body,status,decision,created,updated FROM ideas_v44 WHERE guild_id=? AND author_id=? ORDER BY id DESC LIMIT 200").all(this.guild, user);
    const actions = this.db.query("SELECT action,at,outcome FROM audit WHERE actor_id=? ORDER BY at DESC LIMIT 200").all(user);
    return { user, generated: timestamp(), scope: "Bis zu 200 eigene Einträge pro Kategorie; keine vollständige Plattformauskunft.", cases, requests, ideas, actions,
      further_data: "Fallgespräche liegen gegebenenfalls in Discord; eine vollständige Auskunft bitte über /datenanfrage oder den externen Kontakt anfordern." };
  }
  createIdea(user: string, title: string, body: string, at = timestamp()) {
    title = cleanText(title, 100, "Titel"); body = cleanText(body, 1500, "Vorschlag");
    const recent = this.db.query("SELECT MAX(created) AS at FROM ideas_v44 WHERE guild_id=? AND author_id=?").get(this.guild,user) as any;
    if (recent?.at && at - recent.at < 300) throw new PublicError("Bitte warte fünf Minuten vor einem weiteren Vorschlag.");
    const id = this.db.query("INSERT INTO ideas_v44(guild_id,author_id,title,body,created,updated) VALUES (?,?,?,?,?,?)").run(this.guild,user,title,body,at,at).lastInsertRowid;
    return Number(id);
  }
  ideas(page = 1, user?: string) {
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000) throw new PublicError("Bitte eine gültige Seite wählen.");
    return this.db.query(`SELECT * FROM ideas_v44 WHERE guild_id=? ${user ? "AND author_id=?" : ""} ORDER BY id DESC LIMIT 5 OFFSET ?`)
      .all(...(user ? [this.guild,user,(page-1)*5] : [this.guild,(page-1)*5])) as any[];
  }
  decideIdea(id: number, status: string, reason: string, actor: string, at = timestamp()) {
    if (!Object.hasOwn(IDEA_STATUS, status)) throw new PublicError("Bitte einen gültigen Ideenstatus wählen.");
    reason = cleanText(reason, 500, "Öffentliche Begründung");
    const row = this.db.query("SELECT author_id FROM ideas_v44 WHERE id=? AND guild_id=?").get(id,this.guild) as any;
    if (!row) throw new PublicError("Vorschlag nicht gefunden.");
    if (row.author_id === actor) throw new PublicError("Über deinen eigenen Vorschlag entscheidet eine andere zuständige Person.");
    this.db.query("UPDATE ideas_v44 SET status=?,decision=?,updated=? WHERE id=? AND guild_id=?").run(status,reason,at,id,this.guild);
  }
  draft<T>(kind: string, actor: string, payload: T, at = timestamp()) {
    const id = crypto.randomUUID();
    this.db.query("INSERT INTO drafts_v44 VALUES (?,?,?,?, 'draft',?,?,NULL)").run(id,kind,actor,JSON.stringify(payload),at,at+900);
    return { id, kind, actor_id: actor, payload, expires: at+900 };
  }
  inspectDraft(id: string, kind: string, actor: string, at = timestamp()) {
    const d = this.db.query("SELECT * FROM drafts_v44 WHERE id=? AND kind=? AND actor_id=?").get(id,kind,actor) as any;
    if (!d || d.state !== "draft" || d.expires < at) throw new PublicError("Diese Vorschau ist abgelaufen, bereits verwendet oder gehört einer anderen Person.");
    return { ...d, payload: JSON.parse(d.payload) };
  }
  claimDraft(id: string, kind: string, actor: string, at = timestamp()) {
    return this.db.transaction(() => {
      const d = this.inspectDraft(id,kind,actor,at);
      if (this.db.query("UPDATE drafts_v44 SET state='applying' WHERE id=? AND state='draft'").run(id).changes !== 1) throw new PublicError("Die Vorschau wird bereits bearbeitet.");
      return d;
    }).immediate();
  }
  finishDraft(id: string, state: "done" | "cancelled" | "review", resultId?: string) {
    this.db.query("UPDATE drafts_v44 SET state=?,result_id=COALESCE(?,result_id) WHERE id=?").run(state,resultId||null,id);
  }
  publishFinance(id:string,actor:string) {
    return this.db.transaction(()=>{
      const d=this.inspectDraft(id,"finance",actor);
      const result=this.db.query("INSERT INTO finance_reports_v44(period,actor_id,payload,created) VALUES (?,?,?,?)").run(d.payload.period,actor,JSON.stringify(d.payload),timestamp());
      if(this.db.query("UPDATE drafts_v44 SET state='done',result_id=? WHERE id=? AND state='draft'").run(String(result.lastInsertRowid),id).changes!==1)
        throw new PublicError("Dieser Bericht wurde bereits bearbeitet.");
      return Number(result.lastInsertRowid);
    }).immediate();
  }
  projectCheck(id:number, contact:string, budget:number, agreement:string, actor:string, days=30, at=timestamp()) {
    const current=this.db.query("SELECT opener_id,kind,status FROM cases WHERE id=? AND guild_id=?").get(id,this.guild) as any;
    if(!current || current.kind!=="projekt" || current.status!=="open" || current.opener_id===actor)throw new PublicError("Die Projektprüfung braucht einen offenen Fall und eine unbeteiligte Leitung.");
    snowflake(contact);
    if(!Number.isSafeInteger(budget) || budget<0 || budget>100_000_000 || !Number.isSafeInteger(days) || days<7 || days>90)throw new PublicError("Pilotbudget oder Laufzeit sind ungültig.");
    const other=this.db.query(`SELECT c.id FROM cases c JOIN project_reviews p ON c.id=p.case_id WHERE c.guild_id=? AND c.id!=? AND c.status!='closed' AND p.phase='pilot'`).get(this.guild,id);
    if(other)throw new PublicError("Es läuft bereits ein anderer Projektpilot. Zuerst dessen Ergebnis klären.");
    this.db.query("INSERT OR REPLACE INTO project_checks_v44 VALUES (?,?,?,?,?,?,?,?)").run(id,contact,budget,agreement,actor,at,at,at+days*DAY);
  }
  projectReady(id:number) {return this.db.query("SELECT * FROM project_checks_v44 WHERE case_id=?").get(id) as {contact_id:string;budget:number;agreement:string;pilot_start:number;pilot_end:number}|null;}
  cleanup(at = timestamp()) {
    this.db.query("UPDATE drafts_v44 SET state='expired',payload='{}' WHERE state='draft' AND expires<?").run(at);
    this.db.query("UPDATE drafts_v44 SET payload='{}' WHERE state IN ('done','cancelled','expired') AND created<?").run(at-DAY);
    this.db.query("UPDATE ideas_v44 SET author_id='removed',title='Entfernter Vorschlag',body='',decision='' WHERE guild_id=? AND status IN ('umgesetzt','abgelehnt') AND updated<?").run(this.guild,at-90*DAY);
  }
}

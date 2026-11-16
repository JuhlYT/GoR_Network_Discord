/** GoR Network bot, v4.5.0. Repository and container deployment (Bun).
 * Managed setup preserves unowned areas and member assignments; no message-content intent.
 * A persistent volume is required for case and publication management, not for connecting.
 */
import { Database } from "bun:sqlite";
import { mkdirSync, chmodSync, writeFileSync, renameSync, readdirSync, unlinkSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { storageLocation } from "./storage_path";
import { CommandRegistrar, syncRestCommands } from "./command_registry";
import { commands44 } from "./commands_v44";
import { Update44 } from "./update44";
import { PublicError } from "./feature_base";
import { setProtection } from "./change_plan";
import { publicUrl } from "./legal_config";
import { cents } from "./feature_base";
import { reviewAssignedAccess } from "./access_review";
import type { CasePreset } from "./community_state";
export { commandShape } from "./command_registry";
import { reconcileServer, hydrateManagedMaps, adoptSetupResource, SETUP_ISSUES, issueCode, resourceKnown, type SetupReport, type SetupContext } from "./auto_setup";
import { SetupJournal } from "./setup_journal";
import { SETUP_CONTROLS, setupPolicy, setupButtons } from "./setup_controls";
import { BASIC } from "./setup_permissions";
import { supportView } from "./server_content";
import { communityHub, guideView, faqView, communityNavigation, sameCommunityPanel, GUIDE_TOPICS, FAQ_TOPICS,
  PROJECT_PHASES, isProjectPhase, canAdvanceProject, pageWindow, type ProjectPhase } from "./community_ui";
import {
  Client, GatewayIntentBits, Events, PermissionFlagsBits as P, ChannelType,
  SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  MessageFlags, ActivityType, GuildMember, TextChannel, OverwriteType, escapeMarkdown,
  type Interaction, type Guild, type RepliableInteraction,
} from "discord.js";

export const VERSION = "4.5.0";
export const GUILD = "1571171516677361704";
export const APPLICATION = "1571174833025450064";
export const ROLES: Record<string, string> = {
  networkleitung: "1571182674100617255", communityleitung: "1571182704873971744",
  moderation: "1571182733042917508", support: "1571182760360673543",
  technik: "1571182790240636979", finanzen: "1571182812097290421",
  eventteam: "1571182839423307882", "cw-leitung": "1571182864043610174",
  "cw-team": "1571182887431176317", creator: "1571182910273232978",
  partner: "1571182933044371667", "cw-spieler": "1571182963545342106",
  "ping-netzwerk": "1571183010680799341", "ping-events": "1571183034198130852",
  "ping-cw": "1571183057866719386", "ping-entwicklung": "1571183089013493901",
};
export const CATEGORIES: Record<string, string> = {
  ankommen: "1571184462946107473", community: "1571186548886741143",
  spielen: "1571186699613118624", unterstuetzung: "1571186817649344673",
  hilfe: "1571186887882711040", clonewars: "1571187026882076853",
  team: "1571187232776130574", leitung: "1571187405946626128",
  "finanzen-intern": "1571187506005807294", "cw-team": "1571187592228241560",
};
export const CHANNELS: Record<string, string> = {
  start: "1571184483300933632", regeln: "1571184503433728171", neuigkeiten: "1571184529966768259",
  projekte: "1571184572853395606", termine: "1571186525025210389", lounge: "1571186578280284161",
  vorstellungen: "1571186607002882099", mitspielersuche: "1571186633636847786", ideen: "1571186655090581607",
  fragen: "1571186677710459103", "voice-lounge": "1571186727542984754", "voice-spielrunde1": "1571186749265289350",
  "voice-spielrunde2": "1571186769372782813", "voice-afk": "1571186793863450714",
  "gor-unterstuetzen": "1571186839254081686", "kosten-und-stand": "1571186866961785013",
  support: "1571186913786994709", "netzwerk-aufnahme": "1571186935282663514", kontakt: "1571186982908993687",
  "support-voice": "1571187003146379315", "cw-start": "1571187050399535186", "cw-neuigkeiten": "1571187079365525677",
  "cw-austausch": "1571187099862966302", "cw-events": "1571187119928508486", "cw-fehler": "1571187140870541564",
  "cw-ideen": "1571187167332409424", "cw-besprechung": "1571187190698876930", "cw-lounge": "1571187213461491794",
  "team-info": "1571187254389510164", "team-austausch": "1571187283011571752", "team-aufgaben": "1571187308386975824",
  "discord-updates": "1571187329157300345", "automod-alarm": "1571187350476693654", "team-voice": "1571187377408315462",
  entscheidungen: "1571187433024913508", projektaufnahmen: "1571187468525506671", finanzbelege: "1571187534418149418",
  finanzplanung: "1571187565384573088", "cw-teamchat": "1571187615728935062", "cw-aufgaben": "1571187640403755229",
  "cw-teamvoice": "1571187663975878678",
};
export const KINDS: Record<string, { title: string; roles: string[] }> = {
  allgemein: { title: "Allgemeine Hilfe", roles: ["networkleitung", "communityleitung", "moderation", "support"] },
  technik: { title: "Spiel und Technik", roles: ["networkleitung", "communityleitung", "support", "technik"] },
  beschwerde: { title: "Beschwerde", roles: ["networkleitung", "communityleitung", "moderation"] },
  zahlung: { title: "Zahlungsanliegen", roles: ["networkleitung", "finanzen"] },
  projekt: { title: "Projektaufnahme", roles: ["networkleitung", "communityleitung"] },
  datenschutz: { title: "Datenschutzanfrage", roles: [] },
  einspruch: { title: "Überprüfung / Einspruch", roles: ["networkleitung", "communityleitung"] },
};
export const SELF_ROLES: Record<string, string> = {
  "cw-spieler": "Clone Wars · Spieler", "ping-netzwerk": "Neuigkeiten zum Network",
  "ping-events": "Community-Events", "ping-cw": "Clone Wars · Neuigkeiten", "ping-entwicklung": "Entwicklungsupdates",
};
const ANNOUNCE_TARGETS = { neuigkeiten: "Network-Neuigkeiten", termine: "Community-Termine", "cw-neuigkeiten": "Clone Wars" };
const MENTIONS = { parse: [] as [], repliedUser: false };
const COLOR = 0xd9ab56;
const now = () => Date.now() / 1000;
export class UserError extends PublicError {
  constructor(message: string, public readonly code = "configuration_error") { super(message); }
}
export type RuntimeEnv = Record<string, string | undefined>;
export const TOKEN_KEYS = ["GOR_DISCORD_BOT_TOKEN", "DISCORD_TOKEN", "DISCORD_BOT_TOKEN", "BOT_TOKEN", "TOKEN"] as const;
export function readToken(env: RuntimeEnv) {
  for (const key of TOKEN_KEYS) {
    let value = env[key]?.trim();
    if (!value) continue;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1).trim();
    value = value.replace(/^Bot\s+/i, "").trim();
    if (value) return { value, key };
  }
  return null;
}
export function runtimeSettings(env: RuntimeEnv) {
  const { directory, hasVolume } = storageLocation(env);
  const railway = !!env.RAILWAY_ENVIRONMENT_ID;
  const storage = hasVolume ? "persistent" : railway ? "temporary" : "local";
  const supportEnabled = storage !== "temporary" && !["false", "0", "off", "no"].includes((env.GOR_SUPPORT_ENABLED ?? "true").trim().toLowerCase());
  return { directory, storage, supportEnabled };
}
const TEMPORARY_ACTIONS = new Set(["einrichten", "update_vorschau", "update_anwenden", ...Object.values(SETUP_CONTROLS), "start", "hilfe", "faq", "status", "rechtliches", "events", "finanzbericht", "einrichtung", "rollen", "unterstuetzen", "serverpruefen", "gor:audit:v5", "gor:roles:v4", "gor:roles:open:v5", "gor44:legal", "gor44:status", "gor44:events", "gor44:finance", "gor44:payment",
  ...GUIDE_TOPICS.map(topic => "gor:guide:v5:" + topic)]);
export function requireStorage(settings: ReturnType<typeof runtimeSettings>, action: string) {
  const previewAction = /^gor44:(update:apply|draft:cancel):[a-f0-9-]{36}$/.test(action);
  if (settings.storage === "temporary" && !TEMPORARY_ACTIONS.has(action) && !previewAction)
    throw new UserError(`Der Bot kann Anfragen derzeit nicht dauerhaft speichern. Diese Funktion benötigt den verbundenen Datenspeicher. Die automatische Servergestaltung und /einrichten sind verfügbar. Die Networkleitung hilft dir über <#${CHANNELS.kontakt}> weiter.`, "storage_required");
}
export function errorDiagnostic(error: any) {
  const code = error?.code ?? error?.cause?.code;
  if (code === "storage_required") return { code, hint: "Anfragen und neue Anlagen benötigen ein tatsächlich verbundenes Railway-Volume. Vorhandene GoR-Bereiche werden im Gestaltungsmodus weiter gepflegt." };
  if (code === "startup_timeout") return { code, hint: "Die Discord-Verbindung wurde innerhalb von 120 Sekunden nicht bestätigt. Die letzte Startphase und den Netzwerkzugriff auf Discord prüfen." };
  if (code === "EACCES" || code === "EPERM" || code === "SQLITE_READONLY")
    return { code: "storage_permissions", hint: "Das Datenverzeichnis oder die Datenbank ist nicht beschreibbar. Volume-Zugriff und Containerstart prüfen." };
  if (["SQLITE_CANTOPEN", "SQLITE_NOTADB", "SQLITE_CORRUPT"].includes(code))
    return { code: "database_unavailable", hint: "Die Bot-Datenbank konnte nicht geöffnet oder geprüft werden. Volume und Sicherung prüfen; vorhandene Daten nicht löschen." };
  if (code === "wrong_application") return { code, hint: "Der Token gehört nicht zur vorgesehenen GoR-Anwendung. Den richtigen Bot-Token verwenden." };
  if (code === "commands_unconfirmed") return { code, hint: "Discord bestätigt noch nicht alle Befehle. commands_definition_failed nennt den betroffenen Befehl und einen festen Diagnosecode; erneute Prüfung nach einer Minute." };
  if (code === "wrong_guild" || code === 10004 || code === 50001) return { code: "guild_access_missing", hint: "Der Bot benötigt Zugriff auf den vorgesehenen GoR-Server. Einladung und applications.commands prüfen." };
  if (code === 50013) return { code: "permissions_missing", hint: "Discord verweigert einzelne Rechte. Botrolle, Kanalrechte und Befehlsfreigabe prüfen." };
  if (code === 50035) return { code: "command_definition_rejected", hint: "Discord hat eine Befehlsdefinition abgelehnt; der Bot bleibt verbunden." };
  if (code === "TokenInvalid" || code === "TOKEN_INVALID" || code === 4004 || error?.status === 401 || error?.cause?.status === 401)
    return { code: "token_invalid", hint: "Discord lehnt den Bot-Token ab. Den Laufzeitwert im Hosting prüfen." };
  if (["ENOTFOUND", "ENETUNREACH", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT"].includes(code))
    return { code: "network_unavailable", hint: "Discord ist vom Dienst aus nicht erreichbar. Netzwerkzugriff und Trial-Einschränkungen prüfen." };
  return { code: "startup_step_failed", hint: "Ein Startschritt ist fehlgeschlagen. Die davor ausgegebene Startphase prüfen; Zugangsdaten wurden nicht protokolliert." };
}
type Case = { id: number; guild_id: string; opener_id: string; kind: string; channel_id: string | null;
  assignee_id: string | null; status: string; created: number; updated: number };
type Operation = { id: string; kind: string; actor_id: string; target: string; payload: string;
  state: string; discord_id: string | null; created: number; expires: number };

export function eligible(kind: string, memberId: string, roleIds: string[], ownerId: string) {
  return Object.hasOwn(KINDS, kind) && (memberId === ownerId || KINDS[kind].roles.some(k => roleIds.includes(ROLES[k])));
}
export function mayClose(c: Case, memberId: string, ownerId: string) {
  return [c.opener_id, c.assignee_id, ownerId].includes(memberId);
}
export function roleKeys(values: string[]) {
  if (new Set(values).size !== values.length || values.some(k => !Object.hasOwn(SELF_ROLES, k)))
    throw new UserError("Die Rollenwahl enthält eine unzulässige Rolle.");
  return values;
}
export function privacyCheck(overwrites: { id: string; type: number; allow: bigint; deny: bigint }[], c: Case, botId: string) {
  const everyone = overwrites.find(o => o.id === GUILD && o.type === OverwriteType.Role);
  if (!everyone || !(everyone.deny & P.ViewChannel) || (everyone.allow & P.ViewChannel))
    throw new UserError("Der Fallkanal ist nicht ausreichend verborgen.");
  const expected = new Set([c.opener_id, c.assignee_id, botId]);
  for (const o of overwrites) if ((o.allow & P.ViewChannel) && (o.type === OverwriteType.Role || !expected.has(o.id)))
    throw new UserError("Ein nicht zugewiesener Zugriff muss zuerst geprüft werden.");
  for (const id of [c.opener_id, botId]) if (!overwrites.some(o => o.id === id && o.type === OverwriteType.Member && (o.allow & P.ViewChannel) && !(o.deny & P.ViewChannel)))
    throw new UserError("Der Zugriff eines benötigten Beteiligten ist noch nicht bestätigt.");
}

export class Store {
  db: Database;
  directory: string;
  lastBackup = 0;
  backupHealthy = true;
  constructor(directory: string) {
    this.directory = resolve(directory); mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    this.db = new Database(join(this.directory, "support.sqlite"), { create: true, strict: true });
    this.db.exec("PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;");
    if ((this.db.query("PRAGMA quick_check").get() as any).quick_check !== "ok") throw new UserError("Die Datenbankprüfung ist fehlgeschlagen.");
    this.db.exec(`CREATE TABLE IF NOT EXISTS cases (id INTEGER PRIMARY KEY, guild_id TEXT NOT NULL, opener_id TEXT NOT NULL,
      kind TEXT NOT NULL, channel_id TEXT, assignee_id TEXT, status TEXT NOT NULL, created REAL NOT NULL, updated REAL NOT NULL);
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, at REAL NOT NULL, actor_id TEXT NOT NULL,
      action TEXT NOT NULL, resource TEXT NOT NULL, outcome TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS operations (id TEXT PRIMARY KEY, kind TEXT NOT NULL, actor_id TEXT NOT NULL,
      target TEXT NOT NULL, payload TEXT NOT NULL, state TEXT NOT NULL, discord_id TEXT, created REAL NOT NULL, expires REAL NOT NULL);
      CREATE TABLE IF NOT EXISTS interactions (id TEXT PRIMARY KEY, created REAL NOT NULL);
      CREATE TABLE IF NOT EXISTS project_reviews (case_id INTEGER PRIMARY KEY, phase TEXT NOT NULL, actor_id TEXT NOT NULL, updated REAL NOT NULL);
      CREATE INDEX IF NOT EXISTS case_queue ON cases(guild_id,status);
      CREATE INDEX IF NOT EXISTS case_opener ON cases(guild_id,opener_id,created);`);
    chmodSync(join(this.directory, "support.sqlite"), 0o600);
    this.db.query("UPDATE cases SET status='needs_review',updated=? WHERE status IN ('creating','assigning','closing')").run(now());
    this.db.query("UPDATE operations SET state='needs_review' WHERE state='sending'").run();
    this.cleanup();
  }
  health() { return (this.db.query("SELECT 1 AS ok").get() as any).ok === 1; }
  consume(id: string) { return this.db.query("INSERT OR IGNORE INTO interactions VALUES (?,?)").run(id, now()).changes === 1; }
  reserve(openerId: string, kind: string, timestamp = now()): Case {
    if (!Object.hasOwn(KINDS, kind)) throw new UserError("Unbekannte Fallart.");
    return this.db.transaction(() => {
      const rows = this.db.query("SELECT * FROM cases WHERE guild_id=? AND opener_id=? AND status!='closed'").all(GUILD, openerId) as Case[];
      if (rows.some(r => r.kind === kind)) throw new UserError("Für diese Fallart gibt es bereits einen offenen oder zu prüfenden Vorgang.");
      if (rows.length >= 3) throw new UserError("Bitte kläre zuerst einen deiner offenen Vorgänge.");
      const last = (this.db.query("SELECT MAX(created) AS last FROM cases WHERE guild_id=? AND opener_id=?").get(GUILD, openerId) as any).last;
      if (last !== null && timestamp - last < 60) throw new UserError("Bitte warte eine Minute vor einer weiteren Anfrage.");
      const highest = (this.db.query("SELECT MAX(id) AS id FROM cases").get() as any).id || 0;
      const id = Math.max(highest, Number(this.setting("case_id_highwater") || 0)) + 1;
      if (!Number.isSafeInteger(id)) throw new UserError("Die Fallnummern müssen vor der Fortsetzung geprüft werden.");
      this.db.query("INSERT INTO cases(id,guild_id,opener_id,kind,status,created,updated) VALUES (?,?,?,?,'creating',?,?)").run(id,GUILD,openerId,kind,timestamp,timestamp);
      this.setting("case_id_highwater",String(id)); return this.get(id);
    }).immediate();
  }
  get(id: number): Case {
    const c = this.db.query("SELECT * FROM cases WHERE id=? AND guild_id=?").get(id, GUILD) as Case | null;
    if (!c) throw new UserError("Fall nicht gefunden."); return c;
  }
  change(id: number, fields: Partial<Pick<Case, "channel_id" | "assignee_id" | "status">>) {
    const keys = Object.keys(fields);
    if (!keys.length || keys.some(k => !["channel_id", "assignee_id", "status"].includes(k))) throw new UserError("Unzulässige Änderung.");
    this.db.query(`UPDATE cases SET ${keys.map(k => k + "=?").join(",")},updated=? WHERE id=? AND guild_id=?`)
      .run(...keys.map(k => (fields as any)[k]), now(), id, GUILD);
    return this.get(id);
  }
  queue(): Case[] { return this.db.query("SELECT * FROM cases WHERE guild_id=? AND status!='closed' ORDER BY created").all(GUILD) as Case[]; }
  memberCases(userId: string): Case[] {
    return this.db.query("SELECT * FROM cases WHERE guild_id=? AND opener_id=? ORDER BY id DESC LIMIT 10").all(GUILD, userId) as Case[];
  }
  projectPhase(id: number): ProjectPhase {
    if (this.get(id).kind !== "projekt") throw new UserError("Dieser Fall ist keine Projektanfrage.");
    const row = this.db.query("SELECT phase FROM project_reviews WHERE case_id=?").get(id) as { phase: string } | null;
    if (row && !isProjectPhase(row.phase)) throw new UserError("Der Projektstand muss von der Leitung geprüft werden.");
    return row?.phase as ProjectPhase || "neu";
  }
  setProjectPhase(id: number, next: string, actor: string) {
    return this.db.transaction(() => {
      const c = this.get(id), previous = this.projectPhase(id);
      if (c.status !== "open") throw new UserError("Die Projektanfrage ist nicht offen oder muss zuerst geprüft werden.");
      if (c.opener_id === actor) throw new UserError("Deine eigene Projektanfrage muss eine andere zuständige Leitung prüfen.");
      if (!isProjectPhase(next) || !canAdvanceProject(previous, next))
        throw new UserError(`Dieser Phasenwechsel ist nicht möglich. Aktuell: ${PROJECT_PHASES[previous]}. Der Ablauf ist Neu → Prüfung → Gespräch → Pilotphase → Aufnahme; eine Ablehnung ist in jeder offenen Phase möglich.`);
      this.db.query("INSERT OR REPLACE INTO project_reviews(case_id,phase,actor_id,updated) VALUES (?,?,?,?)").run(id, next, actor, now());
      this.db.query("UPDATE cases SET updated=? WHERE id=? AND guild_id=?").run(now(), id, GUILD);
      this.audit(actor, "project_phase", String(id), next);
      return next;
    }).immediate();
  }
  setting(key: string, value?: string) {
    if (value !== undefined) this.db.query("INSERT OR REPLACE INTO settings VALUES (?,?)").run(key, value);
    return (this.db.query("SELECT value FROM settings WHERE key=?").get(key) as any)?.value as string | undefined;
  }
  audit(actor: string, action: string, resource: string, outcome = "confirmed") {
    this.db.query("INSERT INTO audit(at,actor_id,action,resource,outcome) VALUES (?,?,?,?,?)").run(now(), actor, action, resource, outcome);
  }
  draft(actor: string, target: string, title: string, text: string, timestamp = now()) {
    if (!Object.hasOwn(ANNOUNCE_TARGETS, target) || !title.trim() || title.length > 100 || !text.trim() || text.length > 1800)
      throw new UserError("Bitte Ziel, Titel und Text prüfen.");
    const count = (this.db.query("SELECT count(*) AS n FROM operations WHERE actor_id=? AND state='draft' AND expires>?").get(actor, timestamp) as any).n;
    if (count >= 5) throw new UserError("Bitte bestätige oder verwerfe zuerst einen deiner fünf Entwürfe.");
    const id = crypto.randomUUID();
    this.db.query("INSERT INTO operations VALUES (?,'announcement',?,?,?,'draft',NULL,?,?)")
      .run(id, actor, target, JSON.stringify({ title, text }), timestamp, timestamp + 900);
    return this.operation(id);
  }
  operation(id: string): Operation {
    const op = this.db.query("SELECT * FROM operations WHERE id=?").get(id) as Operation | null;
    if (!op) throw new UserError("Vorgang nicht gefunden."); return op;
  }
  startSend(id: string, actor: string, timestamp = now()) {
    const changed = this.db.query("UPDATE operations SET state='sending' WHERE id=? AND actor_id=? AND state='draft' AND expires>?").run(id, actor, timestamp).changes;
    if (!changed) throw new UserError("Der Entwurf ist abgelaufen, gehört einer anderen Person oder wurde bereits bearbeitet.");
    return this.operation(id);
  }
  finish(id: string, state: string, discordId: string | null = null) {
    this.db.query("UPDATE operations SET state=?,discord_id=COALESCE(?,discord_id) WHERE id=?").run(state, discordId, id);
  }
  cancel(id: string, actor: string) {
    if (!this.db.query("UPDATE operations SET state='cancelled',payload='{}' WHERE id=? AND actor_id=? AND state='draft'").run(id, actor).changes)
      throw new UserError("Dieser Entwurf kann nicht mehr verworfen werden.");
  }
  cleanup() {
    this.db.query("UPDATE operations SET state='expired',payload='{}' WHERE state='draft' AND expires<?").run(now());
    this.db.query("UPDATE operations SET payload='{}' WHERE state IN ('confirmed','cancelled','expired') AND created<?").run(now() - 86400);
    this.db.query("DELETE FROM interactions WHERE created<?").run(now() - 86400 * 7);
    this.db.query("DELETE FROM audit WHERE at<?").run(now() - 86400 * 90);
  }
  backup(manual = false) {
    const timestamp = now();
    if (!manual && timestamp - this.lastBackup < 86400) return null;
    if (manual && timestamp - Number(this.setting("manual_backup_at") || 0) < 60) throw new UserError("Bitte warte eine Minute vor der nächsten Sicherung.");
    const dir = join(this.directory, "backups"); mkdirSync(dir, { recursive: true, mode: 0o700 });
    const name = `gor-${manual ? "manual" : "auto"}-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`;
    const temp = join(dir, name + ".tmp");
    try {
      writeFileSync(temp, this.db.serialize(), { mode: 0o600, flag: "wx" }); renameSync(temp, join(dir, name));
      const files = readdirSync(dir).filter(f => /^gor-(auto|manual)-.*\.sqlite$/.test(f)).sort().reverse();
      for(const file of files)if(statSync(join(dir,file)).mtimeMs<Date.now()-30*86400_000)unlinkSync(join(dir,file));
      for (const prefix of ["gor-auto-", "gor-manual-"])
        for (const file of readdirSync(dir).filter(f => /^gor-(auto|manual)-.*\.sqlite$/.test(f)).sort().reverse().filter(f => f.startsWith(prefix)).slice(7)) unlinkSync(join(dir, file));
      this.lastBackup = timestamp; this.backupHealthy = true;
      if (manual) this.setting("manual_backup_at", String(timestamp));
      return name;
    } catch (e) { this.backupHealthy = false; throw e; }
  }
  close() { this.db.close(); }
}

export function commandDefinitions() {
  const command = (name: string, description: string) => new SlashCommandBuilder().setName(name).setDescription(description)
    .setDefaultMemberPermissions(null).setNSFW(false);
  const caseNumber = (b: SlashCommandBuilder) => b.addIntegerOption(o => o.setName("fall").setDescription("Fallnummer").setMinValue(1).setRequired(true));
  return [
    command("start", "Dein persönlicher Einstieg ins GoR Network."),
    command("hilfe", "Dein Weg zu Spielen, Mitspielern und Hilfe."),
    command("faq", "Klare Antworten zu Einstieg, Rollen, Support und Network.")
      .addStringOption(o => o.setName("thema").setDescription("Wozu möchtest du mehr wissen?")
        .addChoices(...Object.entries(FAQ_TOPICS).map(([value, name]) => ({ name, value })))),
    command("status", "Verbindung und Funktionen des GoR Bots prüfen."),
    command("support", "Privates Anliegen an die zuständige Betreuung richten."),
    command("projektanfrage", "Ein Projekt für das GoR Network vorstellen."),
    command("rollen", "Deine Spiel- und Benachrichtigungsrollen selbst auswählen."),
    command("unterstuetzen", "Informationen zur freiwilligen Unterstützung von GoR."),
    command("meine_faelle", "Deine eigenen Anliegen und ihren Bearbeitungsstand anzeigen."),
    command("team", "Dein Teamboard mit Zuständigkeiten und offenen Anliegen.")
      .addIntegerOption(o=>o.setName("fall").setDescription("Für den Inhaber: konkret zu prüfender Aufbewahrungsfall").setMinValue(1))
      .addIntegerOption(o=>o.setName("aufbewahrung").setDescription("Inhaber: Aufbewahrung für 0 bis 365 Tage; 0 beendet die Ausnahme").setMinValue(0).setMaxValue(365))
      .addStringOption(o=>o.setName("grund").setDescription("Begründung der Aufbewahrungsausnahme").addChoices(
        {name:"Laufende Prüfung",value:"laufende_pruefung"},{name:"Rechtliche Sicherung",value:"rechtliche_sicherung"},{name:"Gesetzliche Aufbewahrung",value:"gesetzliche_aufbewahrung"})),
    command("faelle", "Deine zuständigen offenen Supportfälle anzeigen.")
      .addIntegerOption(o => o.setName("seite").setDescription("Seite der Fallübersicht").setMinValue(1)),
    caseNumber(command("projektstatus", "Leitung: die Aufnahmephase eines Serverprojekts fortschreiben."))
      .addStringOption(o => o.setName("phase").setDescription("Nächster Schritt in der Projektaufnahme").setRequired(true)
        .addChoices(...Object.entries(PROJECT_PHASES).filter(([value]) => value !== "neu").map(([value, name]) => ({ name, value }))))
      .addUserOption(o=>o.setName("ansprechpartner").setDescription("Bestätigter Ansprechpartner des Piloten"))
      .addNumberOption(o=>o.setName("pilotbudget").setDescription("Freigegebene Budgetgrenze in Euro; 0 ist möglich").setMinValue(0).setMaxValue(1_000_000))
      .addStringOption(o=>o.setName("vereinbarung").setDescription("HTTPS-Verweis zur tatsächlich bestätigten Projektvereinbarung").setMaxLength(500))
      .addBooleanOption(o=>o.setName("absprachen_geprueft").setDescription("Betreiber, Budget, Rechte, Datenwege und Ausstieg wurden geklärt"))
      .addIntegerOption(o=>o.setName("pilottage").setDescription("7 bis 90 Tage; Standard 30").setMinValue(7).setMaxValue(90))
      .addBooleanOption(o=>o.setName("pilot_ausgewertet").setDescription("Leitung: Betreuung, Kosten und Spielerrückmeldung wurden ausgewertet")),
    caseNumber(command("uebernehmen", "Einen zuständigen Fall als unbeteiligter Bearbeiter übernehmen.")),
    caseNumber(command("schliessen", "Einen eigenen oder zugewiesenen Fall abschließen.")),
    caseNumber(command("fall_zuordnen", "Inhaber: bestehenden Kanal nach einer unklaren Aktion bestätigen."))
      .addChannelOption(o => o.setName("kanal").setDescription("Bestehender Fallkanal").addChannelTypes(ChannelType.GuildText).setRequired(true)),
    command("supportpanel", "Inhaber: das Supportbedienfeld veröffentlichen oder aktualisieren."),
    command("communitypanel", "Inhaber: das zentrale Community-Menü im Startkanal veröffentlichen."),
    command("einrichtung", "Leitung: Stand der automatischen GoR-Einrichtung anzeigen."),
    command("einrichten", "Inhaber: GoR-Einrichtung jetzt automatisch abgleichen."),
    command("einrichtung_automatik", "Inhaber: automatische GoR-Pflege aktivieren oder pausieren.")
      .addBooleanOption(o => o.setName("aktiv").setDescription("Automatische Pflege einschalten").setRequired(true))
      .addStringOption(o => o.setName("schutz").setDescription("Gestaltungsfeld schützen, z. B. channel:lounge:topic").setMaxLength(100))
      .addIntegerOption(o => o.setName("stunden").setDescription("0 hebt Schutz auf; sonst 1 bis 168 Stunden").setMinValue(0).setMaxValue(168))
      .addUserOption(o => o.setName("datenschutz_person").setDescription("Benannte Person für private Datenschutzanfragen"))
      .addBooleanOption(o => o.setName("kontakt_entfernen").setDescription("Die benannte Person aus der Datenschutzzuständigkeit entfernen")),
    command("einrichtung_zuordnen", "Inhaber: einen vorhandenen Eintrag nach unklarer Anlage zuordnen.")
      .addStringOption(o => o.setName("schluessel").setDescription("Fester Schlüssel aus /einrichtung, z. B. role:support").setRequired(true))
      .addStringOption(o => o.setName("id").setDescription("Discord-ID des bereits vorhandenen Eintrags").setRequired(true)),
    command("einrichtung_freigeben", "Inhaber: nach Prüfung eine sicher nicht erfolgte Anlage freigeben.")
      .addStringOption(o => o.setName("schluessel").setDescription("Unklarer Schlüssel aus /einrichtung").setRequired(true))
      .addBooleanOption(o => o.setName("nicht_vorhanden").setDescription("Ich habe geprüft: Der Eintrag wurde nicht angelegt").setRequired(true)),
    command("communitypanel_zuordnen", "Inhaber: ein bereits vorhandenes Community-Menü bestätigen.")
      .addStringOption(o => o.setName("nachricht").setDescription("Nachrichten-ID im Startkanal").setRequired(true)),
    command("panel_zuordnen", "Inhaber: ein bereits vorhandenes Supportbedienfeld bestätigen.")
      .addStringOption(o => o.setName("nachricht").setDescription("Nachrichten-ID im Supportkanal").setRequired(true)),
    command("serverpruefen", "Leitung: Struktur, Rechte und Community-Funktionen prüfen."),
    command("ankuendigung", "Leitung: Ankündigung zuerst als private Vorschau vorbereiten.")
      .addStringOption(o => o.setName("ziel").setDescription("Veröffentlichung in").setRequired(true)
        .addChoices(...Object.entries(ANNOUNCE_TARGETS).map(([value, name]) => ({ name, value }))))
      .addStringOption(o => o.setName("titel").setDescription("Titel").setMaxLength(100).setRequired(true))
      .addStringOption(o => o.setName("text").setDescription("Text der Ankündigung").setMaxLength(1800).setRequired(true)),
    command("vorgaenge", "Inhaber: unbestätigte Veröffentlichungen zur Prüfung anzeigen."),
    command("vorgang_zuordnen", "Inhaber: eine unklare Veröffentlichung ohne erneutes Senden bestätigen.")
      .addStringOption(o => o.setName("vorgang").setDescription("Vorgangs-ID").setRequired(true))
      .addStringOption(o => o.setName("nachricht").setDescription("Nachrichten-ID im ursprünglichen Zielkanal").setRequired(true)),
    command("backup", "Inhaber: eine lokale Sicherung der Bot-Datenbank erstellen."),
    ...commands44(),
  ].map(c => c.toJSON());
}

export function panel() {
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("gor:support:v3").setLabel("Privaten Support öffnen").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("gor:projekt:v3").setLabel("Projekt vorstellen").setStyle(ButtonStyle.Secondary),
  )];
}
const panelBody = "**GoR Network · Wir helfen dir weiter**\nFragen, technische Probleme oder eine Projektidee? Wähle deinen Weg.\nBitte sende keine Passwörter oder Tokens. Zahlungsanliegen werden privat behandelt.";
function embed(title: string, description: string) {
  return new EmbedBuilder().setColor(COLOR).setTitle(title).setDescription(description).setFooter({ text: "GoR Network · Gemeinsam mehr erreichen" });
}
export function announcementEmbed(op: Operation) {
  const { title, text } = JSON.parse(op.payload);
  return embed(title, text).toJSON();
}
export function sameAnnouncement(op: Operation, message: { author: { id: string }; content: string; embeds: any[] }) {
  const wanted = announcementEmbed(op), got = message.embeds[0];
  return message.author.id === APPLICATION && message.content === "" && message.embeds.length === 1 &&
    got.title === wanted.title && got.description === wanted.description && got.color === wanted.color &&
    got.footer?.text === wanted.footer?.text && !got.footer?.iconURL && !got.footer?.icon_url &&
    !got.url && !got.image && !got.thumbnail && !got.author && !got.timestamp && !got.video && !got.provider &&
    !(got.fields?.length);
}
async function answer(i: RepliableInteraction, content: string, extra: Record<string, any> = {}) {
  const options = { content, embeds: [], components: [], attachments: [], allowedMentions: MENTIONS, ...extra };
  if (i.deferred || i.replied) await i.editReply(options);
  else await i.reply({ ...options, flags: MessageFlags.Ephemeral });
}
function safeLog(event: string, code?: unknown) {
  // Never serialize Error objects: Discord errors may contain request bodies or credentials.
  console.log(JSON.stringify({ at: new Date().toISOString(), event, ...(typeof code === "number" ? { code } : {}) }));
}
function logFailure(event: string, error: unknown) {
  // Only fixed diagnostic strings are logged, never an Error object or request body.
  console.error(JSON.stringify({ at: new Date().toISOString(), event, ...errorDiagnostic(error) }));
}
function own(member: GuildMember) {
  if (member.id !== member.guild.ownerId) throw new UserError("Diese Funktion führt der Serverinhaber aus.");
}
function leadership(member: GuildMember) {
  if (member.id !== member.guild.ownerId && !["networkleitung", "communityleitung"].some(k => member.roles.cache.has(ROLES[k])))
    throw new UserError("Für diese Funktion fehlt die Zuständigkeit in der Networkleitung.");
}
export function validateIdentity(userId: string | undefined, appId: string | undefined, guildId: string, _admin?: boolean) {
  if (userId !== APPLICATION || appId !== APPLICATION) throw new UserError("Die Anwendung passt nicht zum GoR Bot.", "wrong_application");
  if (guildId !== GUILD) throw new UserError("Dieser Server passt nicht zum GoR Network.", "wrong_guild");
}
async function textChannel(guild: Guild, id: string) {
  const channel = await guild.channels.fetch(id, { force: true });
  if (!(channel instanceof TextChannel)) throw new UserError("Der gespeicherte Textkanal fehlt."); return channel;
}
function checkPrivacy(channel: TextChannel, c: Case) {
  if (channel.guild.id !== GUILD || channel.parentId !== CATEGORIES.hilfe || channel.topic !== `gor-case:${c.id}`)
    throw new UserError("Server, Kategorie oder Fallkennung passen nicht zur Zuordnung.");
  privacyCheck([...channel.permissionOverwrites.cache.values()].map(o => ({ id: o.id, type: o.type, allow: o.allow.bitfield, deny: o.deny.bitfield })), c, APPLICATION);
}
async function caseChannel(guild: Guild, c: Case) {
  if (!c.channel_id) throw new UserError("Dieser Fall muss zuerst vom Inhaber geprüft werden.");
  const channel = await textChannel(guild, c.channel_id); checkPrivacy(channel, c); return channel;
}
export function caseModal(kind: string) {
  if (!Object.hasOwn(KINDS, kind)) throw new UserError("Unbekannte Fallart.");
  if (kind === "projekt") return new ModalBuilder().setCustomId("gor:project:v5").setTitle("Dein Projekt für GoR Network").addComponents(
    ...[
      ["project", "Projektname", TextInputStyle.Short, 80, true, "Wie heißt dein Projekt?"],
      ["game", "Spiel und Spielmodus", TextInputStyle.Short, 80, true, "Zum Beispiel Minecraft Survival oder GMod RP"],
      ["scale", "Stand, Team und aktive Spieler", TextInputStyle.Short, 120, true, "Konzept / im Aufbau / live · Team · Spieler"],
      ["proposal", "Idee und gewünschte Zusammenarbeit", TextInputStyle.Paragraph, 450, true, "Was macht euch aus und was möchtet ihr gemeinsam mit GoR erreichen?"],
      ["contact", "Kontakt oder öffentlicher Projektlink", TextInputStyle.Short, 300, false, "Optional: öffentlicher Discord- oder Weblink"],
    ].map(([id, label, style, limit, required, placeholder]) => new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId(id as string).setLabel(label as string).setStyle(style as TextInputStyle)
        .setMaxLength(limit as number).setRequired(required as boolean).setPlaceholder(placeholder as string))),
  );
  return new ModalBuilder().setCustomId("gor:case:" + kind).setTitle(KINDS[kind].title).addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("summary")
      .setLabel(kind === "projekt" ? "Projekt und Spiel" : "Worum geht es?").setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(true)),
    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("details")
      .setLabel(kind === "projekt" ? "Stand und gewünschte Zusammenarbeit" : "Ablauf und wichtige Einzelheiten")
      .setPlaceholder("Keine Passwörter, Tokens oder privaten Mitgliederlisten senden.").setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(true)),
  );
}

export function healthResponse(path: string, ready: boolean, dbOk: boolean, state: string, details: Record<string, string> = {}) {
  const status = path === "/live" ? 200 : (path === "/health" || path === "/ready") ? (ready && dbOk ? 200 : 503) : 404;
  return Response.json({ service: "gor-network", version: VERSION, status: status === 404 ? "not_found" : path === "/live" ? "alive" : ready && dbOk ? "ready" : state, ...details },
    { status, headers: { "Cache-Control": "no-store" } });
}

export async function main(options: { createClient?: () => Client; environment?: RuntimeEnv; startupTimeoutMs?: number; setupRunner?: (context: SetupContext) => Promise<SetupReport>; setupDebounceMs?: number } = {}) {
  process.umask(0o077);
  console.log(JSON.stringify({ at: new Date().toISOString(), event: "service_starting", version: VERSION }));
  const env = options.environment || Bun.env;
  const settings = runtimeSettings(env), layoutPolicy = setupPolicy(settings.storage);
  if (settings.storage === "temporary") safeLog("storage_temporary_support_paused");
  if (settings.storage === "persistent" && env.GOR_DATA_DIR
      && storageLocation({ GOR_DATA_DIR: env.GOR_DATA_DIR }).directory !== settings.directory)
    safeLog("data_directory_uses_attached_volume");
  safeLog("database_opening");
  const store = new Store(settings.directory);
  const setupMaps = { roles: ROLES, categories: CATEGORIES, channels: CHANNELS };
  hydrateManagedMaps(store, setupMaps);
  safeLog("database_opened");
  const client = options.createClient?.() || new Client({ intents: [GatewayIntentBits.Guilds], allowedMentions: MENTIONS,
    rest: { retries: 0, timeout: 15_000 } });
  let ready = false, verified = false, commandTokenReady = false;
  const commands = new CommandRegistrar(() => syncRestCommands(client.rest, APPLICATION, GUILD, commandDefinitions(), {
    phase: phase => { commands.phase = phase; }, stopped: () => stopped,
    failure: (command, error) => console.error(JSON.stringify({ at: new Date().toISOString(), event: "commands_definition_failed", command, ...errorDiagnostic(error) })),
  }));
  let state = "starting", stopped = false, lastHealthy = Date.now(), administratorReported = false;
  const setupEnabled = !["false", "0", "off", "no"].includes((env.GOR_AUTO_SETUP ?? "true").trim().toLowerCase());
  let setupRunning = false, setupState = "pending", lastSetupAttempt = 0;
  let setupWake: ReturnType<typeof setTimeout> | undefined;
  let setupReport: SetupReport | null = null;
  try { setupReport = JSON.parse(store.setting("auto_setup_report") || "null"); } catch {}
  let maintenance: ReturnType<typeof setTimeout> | undefined;
  let startupDeadline: ReturnType<typeof setTimeout> | undefined;
  const server = Bun.serve({ hostname: "0.0.0.0", port: Number(env.PORT || 8080),
    fetch(request) { let dbOk = false; try { dbOk = store.health(); } catch {}
      return healthResponse(new URL(request.url).pathname, ready && client.isReady(), dbOk, state,
        { storage: settings.storage, commands: commands.ready ? "registered" : "pending", command_phase: commands.phase,
          command_count: String(commands.confirmed), command_total: String(commandDefinitions().length), setup: setupState,
          setup_mode: layoutPolicy.allowCreate ? "full" : "existing_resources" }); } });
  safeLog("health_listener_started");
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T,>(fn: () => Promise<T>) => {
    const task = queue.then(fn); queue = task.catch(() => {}); return task;
  };
  const features = new Update44({ store, env, guild:GUILD,application:APPLICATION,version:VERSION,maps:setupMaps, answer,
    createCase:(i,member,kind,preset)=>serial(()=>createCase(i,member,kind,preset)),caseChannel,serial,applySetup:before=>runSetup(true,before),
    reviewAccess:()=>serial(async()=>reviewAssignedAccess(await client.guilds.fetch(GUILD),store,APPLICATION,canHandle,caseChannel)),
    status:()=>({connected:ready && client.isReady(),commands:commands.ready,commandCount:commands.confirmed,commandTotal:commandDefinitions().length,
      setup:setupState,storage:settings.storage}) });
  safeLog("community44_storage_ready");
  async function shutdown(code: number) {
    if (stopped) return; stopped = true; ready = false; state = "stopping"; clearTimeout(maintenance); clearTimeout(startupDeadline);
    clearTimeout(setupWake);
    const force = setTimeout(() => process.exit(code || 1), 12_000); force.unref();
    await queue; await client.destroy();
    try { store.backup(); } catch { safeLog("backup_failed"); }
    server.stop(true); store.close(); clearTimeout(force); process.exit(code);
  }
  process.once("SIGTERM", () => { void shutdown(0); }); process.once("SIGINT", () => { void shutdown(0); });
  process.on("unhandledRejection", error => { logFailure("unhandled_rejection", error); void shutdown(1); });
  client.on(Events.Error, error => logFailure("discord_connection_error", error));
  client.on(Events.ShardDisconnect, event => { ready = false; state = "reconnecting"; safeLog("discord_disconnected", event.code); });
  client.on(Events.ShardResume, () => { if (state === "reconnecting") { ready = verified; state = verified ? "ready" : "checking"; } });
  client.on(Events.ShardError, error => logFailure("discord_gateway_error", error));
  function maintain() {
    if (stopped) return;
    try { store.backup(); store.cleanup(); } catch { safeLog("maintenance_failed"); }
    void features.maintenance().catch(()=>safeLog("community44_maintenance_attention"));
    void registerCommands();
    if (client.isReady()) {
      lastHealthy = Date.now();
      if (verified) void runSetup();
    }
    else if (Date.now() - lastHealthy > 300_000) { safeLog("connection_watchdog_restart"); void shutdown(1); return; }
    maintenance = setTimeout(maintain, 60_000);
    maintenance.unref();
  }

  async function memberFor(i: RepliableInteraction) {
    if (!ready || !client.isReady()) throw new UserError("Der Bot stellt die Verbindung gerade wieder her.");
    if (i.guildId !== GUILD || !i.guild) throw new UserError("Dieser Befehl gehört nur zum GoR Network.");
    const member = await i.guild.members.fetch({ user: i.user.id, force: true });
    if (member.pending) throw new UserError("Bitte bestätige zuerst die Serverregeln."); return member;
  }
  async function assertBot(guild: Guild) {
    const me = await guild.members.fetchMe({ force: true });
    validateIdentity(client.user?.id, client.application?.id, guild.id);
    if (me.permissions.has(P.Administrator) && !administratorReported) {
      administratorReported = true; safeLog("administrator_permission_detected_use_individual_permissions");
    }
    return me;
  }
  function canHandle(c: Case, member: GuildMember) {
    return features.canHandle(c,member,eligible(c.kind, member.id, [...member.roles.cache.keys()], member.guild.ownerId));
  }
  function requireTeam(member: GuildMember) {
    if (!features.isPrivacyContact(member.id) && !Object.keys(KINDS).some(kind => eligible(kind, member.id, [...member.roles.cache.keys()], member.guild.ownerId)))
      throw new UserError("Für deine Rolle ist keine Fallzuständigkeit hinterlegt. Deine eigenen Anfragen findest du unter /meine_faelle.");
  }
  function caseLine(c: Case) {
    const label = ({ open: "Offen", closed: "Abgeschlossen", creating: "Wird vorbereitet", assigning: "In Zuordnung", closing: "Wird abgeschlossen", needs_review: "Wird geprüft" } as Record<string, string>)[c.status] || "Wird geprüft";
    const phase = c.kind === "projekt" ? ` · ${PROJECT_PHASES[store.projectPhase(c.id)]}` : "";
    const policy=features.state.policy(c.id);
    return `**#${c.id} · ${KINDS[c.kind]?.title || "Anliegen"}**\n${label}${phase} · seit <t:${Math.floor(c.created)}:R>\n${c.channel_id ? `<#${c.channel_id}>` : "Die Betreuung bereitet den Kontakt vor"} · ${c.assignee_id ? `Betreuung: <@${c.assignee_id}>` : "Noch nicht übernommen"}${policy?.due?`\nAnfrage-Prüftermin: <t:${Math.floor(policy.due)}:f>`:""}`;
  }
  async function ownCases(i: RepliableInteraction, member: GuildMember) {
    const rows = store.memberCases(member.id);
    await answer(i, "", { embeds: [embed("GoR · Deine Anliegen", rows.length ? rows.map(caseLine).join("\n\n") : "Du hast bisher keine Anfragen gestellt. Wenn du Unterstützung brauchst, öffne /support; für dein Serverprojekt gibt es /projektanfrage.")
      .setFooter({ text: "Nur für dich sichtbar · Bis zu zehn zuletzt gestellte Anfragen" }).toJSON()], components: communityNavigation() });
  }
  async function caseBoard(i: RepliableInteraction, member: GuildMember, requested = 1) {
    requireTeam(member);
    const all = store.queue().filter(c => canHandle(c, member)), page = pageWindow(all, requested);
    const controls = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`gor:queue:v5:${Math.max(1, page.page - 1)}`).setLabel("Zurück").setStyle(ButtonStyle.Secondary).setDisabled(page.page <= 1),
      new ButtonBuilder().setCustomId(`gor:queue:v5:${page.page}`).setLabel("Aktualisieren").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`gor:queue:v5:${page.page + 1}`).setLabel("Weiter").setStyle(ButtonStyle.Secondary).setDisabled(page.page >= page.pages),
    );
    const body = page.items.length ? page.items.map(caseLine).join("\n\n") : "Aktuell liegen keine offenen Fälle in deiner Zuständigkeit vor.";
    await answer(i, "", { embeds: [embed("GoR · Deine Fallübersicht", body)
      .setFooter({ text: `Seite ${page.page}/${page.pages} · ${page.total} zuständige Fälle · Übernahme: /uebernehmen` }).toJSON()], components: [controls.toJSON()] });
  }
  async function rolesView(i: RepliableInteraction, member: GuildMember) {
    const select = new StringSelectMenuBuilder().setCustomId("gor:roles:v4").setPlaceholder("Deine Auswahl · leer = keine dieser Rollen")
      .setMinValues(0).setMaxValues(Object.keys(SELF_ROLES).length).addOptions(Object.entries(SELF_ROLES).map(([value, label]) => ({ value, label, default: member.roles.cache.has(ROLES[value]) })));
    await answer(i, "", { embeds: [embed("GoR · Deine Interessen", "Wähle die Spiele und Themen, die dich interessieren. Du kannst deine Auswahl jederzeit ändern. Deine übrigen Rollen bleiben erhalten.").toJSON()],
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select).toJSON()] });
  }
  async function serverReport(i: RepliableInteraction, member: GuildMember) {
    leadership(member); const guild = member.guild;
    const [roles, channels, me] = await Promise.all([guild.roles.fetch(), guild.channels.fetch(), guild.members.fetchMe({ force: true })]);
    const missingRoles = Object.keys(ROLES).filter(key => !roles.has(ROLES[key]));
    const missingChannels = Object.keys(CHANNELS).filter(key => !channels.has(CHANNELS[key]));
    const missingCategories = Object.keys(CATEGORIES).filter(key => !channels.has(CATEGORIES[key]));
    const basic = [[P.ManageChannels, "Kanäle verwalten"], [P.ManageRoles, "Rollen verwalten"], [P.ViewChannel, "Kanäle sehen"],
      [P.SendMessages, "Nachrichten senden"], [P.EmbedLinks, "Links einbetten"], [P.ReadMessageHistory, "Verlauf lesen"]] as const;
    const missingPermissions = basic.filter(([permission]) => !me.permissions.has(permission)).map(([, label]) => label);
    const roleIssues = Object.keys(SELF_ROLES).filter(key => {
      const role = roles.get(ROLES[key]);
      return !role || role.managed || role.permissions.bitfield !== 0n || role.comparePositionTo(me.roles.highest) >= 0;
    });
    const view = embed("GoR · Stand deines Discords", "Aktuelle Struktur und konkrete Ansatzpunkte für die Leitung.")
      .addFields(
        { name: "Rollen", value: `${Object.keys(ROLES).length - missingRoles.length}/${Object.keys(ROLES).length}`, inline: true },
        { name: "Kategorien", value: `${Object.keys(CATEGORIES).length - missingCategories.length}/${Object.keys(CATEGORIES).length}`, inline: true },
        { name: "Kanäle", value: `${Object.keys(CHANNELS).length - missingChannels.length}/${Object.keys(CHANNELS).length}`, inline: true },
        { name: "Community & Einstieg", value: `Community: ${guild.features.includes("COMMUNITY") ? "bestätigt" : "nicht bestätigt"}\nRegelprüfung: ${guild.features.includes("MEMBER_VERIFICATION_GATE_ENABLED") ? "bestätigt" : "nicht bestätigt"}\nOnboarding: ${(guild.features as string[]).includes("GUILD_ONBOARDING_EVER_ENABLED") ? "wurde eingerichtet; aktuellen Ablauf prüfen" : "nicht bestätigt"}` },
        { name: "Botrechte", value: missingPermissions.length ? "Es fehlen: " + missingPermissions.join(", ") : "Alle sechs geprüften Grundrechte vorhanden." },
        { name: "Rollenwahl", value: roleIssues.length ? "Rollen oder Rangfolge prüfen: " + roleIssues.join(", ") : "Die fünf Auswahlrollen sind vorhanden, ohne Grundrechte und unter der Botrolle." },
        { name: "Fallbetrieb & Sicherung", value: settings.storage === "temporary" ? "Persönliche Fälle sind noch pausiert. Die Leitung muss die dauerhafte Datenhaltung fertigstellen." : `${store.queue().filter(c => canHandle(c, member)).length} offene Fälle in deiner Zuständigkeit.\nLetzte lokale Sicherung: ${store.backupHealthy ? "erfolgreich" : "prüfen"}.` },
      ).setFooter({ text: "Leseprüfung · AutoMod, Kanalüberschreibungen und der aktuelle Onboarding-Ablauf werden separat abgenommen" });
    if (missingRoles.length || missingChannels.length || missingCategories.length || missingPermissions.length || roleIssues.length) view.setColor(0xf2b84b);
    if (missingRoles.length) view.addFields({ name: "Fehlende Rollen", value: missingRoles.join(", ") });
    if (missingCategories.length) view.addFields({ name: "Fehlende Kategorien", value: missingCategories.join(", ") });
    if (missingChannels.length) view.addFields({ name: "Fehlende Kanäle", value: missingChannels.join(", ") });
    await answer(i, "", { embeds: [view.toJSON()], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("gor:audit:v5").setLabel("Stand aktualisieren").setStyle(ButtonStyle.Primary),
    ).toJSON()] });
  }
  async function createCase(i: any, member: GuildMember, kind: string, preset?:CasePreset) {
    if (!settings.supportEnabled) throw new UserError("Der private Support ist noch nicht aktiviert. Bitte kontaktiere die Networkleitung.");
    if (!Object.hasOwn(KINDS, kind)) throw new UserError("Bitte wähle eine gültige Anliegenart.");
    if(kind==="zahlung") { await features.payment(i); return; }
    const application = kind === "projekt" && i.customId === "gor:project:v5";
    const get = (key: string) => escapeMarkdown(i.fields.getTextInputValue(key).trim());
    const details = application ? [
      { name: "Projekt", value: get("project") }, { name: "Spiel & Modus", value: get("game"), inline: true },
      { name: "Aktueller Stand", value: get("scale"), inline: true }, { name: "Konzept & Zusammenarbeit", value: get("proposal") },
      { name: "Kontakt / öffentlicher Projektlink", value: get("contact") || "Kontakt über diesen privaten Fall" },
    ] : [];
    if (details.some(field => !field.value)) throw new UserError("Bitte fülle die Pflichtfelder deiner Projektanfrage aus.");
    const description = application ? "Deine Projektanfrage ist eingegangen. Der aktuelle Schritt ist **Neu eingegangen**. Den weiteren Stand findest du unter /meine_faelle."
      : preset ? `**${escapeMarkdown(preset.summary)}**\n\n${escapeMarkdown(preset.details)}` : `**${get("summary")}**\n\n${get("details")}`;
    const guild = member.guild, me = await assertBot(guild);
    const category = await guild.channels.fetch(CATEGORIES.hilfe, { force: true });
    const needed = [P.ManageChannels, P.ManageRoles, P.ViewChannel, P.SendMessages, P.ReadMessageHistory];
    if (!category || category.type !== ChannelType.GuildCategory || !category.permissionsFor(me).has(needed))
      throw new UserError("Dem Bot fehlen einzelne Rechte an der Supportkategorie. Bitte die Leitung informieren.");
    const channels = await guild.channels.fetch();
    for (const ch of channels.values()) if (ch instanceof TextChannel && ch.parentId === CATEGORIES.hilfe && /^gor-case:\d+$/.test(ch.topic || "")) {
      const n = Number(ch.topic!.slice(9));
      try { const c = store.get(n); if (c.channel_id !== ch.id) throw new Error(); }
      catch { throw new UserError("Es gibt ältere Fallkanäle ohne passende Datenbankzuordnung. Die Leitung muss zuerst die vorhandene Sicherung prüfen."); }
    }
    const c = store.reserve(member.id, kind);
    features.state.open(c,preset);
    try {
      const ch = await guild.channels.create({ name: `${kind === "projekt" ? "projekt" : "fall"}-${String(c.id).padStart(4, "0")}`, type: ChannelType.GuildText,
        parent: CATEGORIES.hilfe, topic: `gor-case:${c.id}`, reason: "GoR privater Supportfall",
        permissionOverwrites: [
          { id: GUILD, type: OverwriteType.Role, deny: [P.ViewChannel] },
          { id: APPLICATION, type: OverwriteType.Member, allow: needed },
          { id: member.id, type: OverwriteType.Member, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.EmbedLinks] },
        ] });
      const saved = store.change(c.id, { channel_id: ch.id, status: "open" });
      const verified = await caseChannel(guild, saved);
      await verified.send({ embeds: [embed(`${KINDS[kind].title} · Fall ${c.id}`,
        `${description}\n\nDu und zugewiesene Bearbeiter sehen diesen Fall. Inhaber und Administratoren können technisch ebenfalls zugreifen. Bitte keine Passwörter, Zahlungs-, Ausweis- oder Gesundheitsunterlagen senden. Hinweise zur Verarbeitung: /rechtliches.\nNach Abschluss wird die Aufbewahrung geprüft; ein Abschluss löscht keine Daten. Eine Betreuung rund um die Uhr wird nicht versprochen.`).addFields(details)], allowedMentions: MENTIONS,
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId("gor:own:v5").setLabel("Meine Anliegen ansehen").setStyle(ButtonStyle.Secondary))] });
      store.audit(member.id, "case_create", String(c.id));
      await answer(i, `Dein privater Fall ist angelegt: <#${verified.id}>. Eine zuständige Person kann ihn übernehmen.`);
    } catch (e) { store.change(c.id, { status: "needs_review" }); store.audit(member.id, "case_create", String(c.id), "needs_review"); throw e; }
  }
  async function safeSelfRoles(member: GuildMember, selected: string[]) {
    roleKeys(selected); const guild = member.guild, me = await assertBot(guild);
    if (!me.permissions.has(P.ManageRoles)) throw new UserError("Dem Bot fehlt die Rollenverwaltung.");
    await guild.roles.fetch(); const channels = await guild.channels.fetch();
    const publicParents = new Set(["ankommen", "community", "spielen", "unterstuetzung", "hilfe", "clonewars"].map(k => CATEGORIES[k]));
    const harmless = BASIC;
    for (const key of Object.keys(SELF_ROLES)) {
      const r = guild.roles.cache.get(ROLES[key]);
      if (!r || r.managed || r.permissions.bitfield !== 0n || r.comparePositionTo(me.roles.highest) >= 0)
        throw new UserError("Eine Auswahlrolle ist verändert oder für den Bot nicht verwaltbar. Bitte die Leitung informieren.");
      for (const ch of channels.values()) if (ch && "permissionOverwrites" in ch) {
        const overwrite = ch.permissionOverwrites.cache.get(r.id); if (!overwrite) continue;
        const publicArea = publicParents.has(ch.type === ChannelType.GuildCategory ? ch.id : ch.parentId || "");
        if ((overwrite.allow.bitfield & ~harmless) || ((overwrite.allow.bitfield & P.ViewChannel) && !publicArea))
          throw new UserError("Eine Auswahlrolle besitzt unerwartete Zugriffe. Die Leitung muss die Rechte zuerst prüfen.");
      }
    }
    const remove = Object.keys(SELF_ROLES).filter(k => !selected.includes(k) && member.roles.cache.has(ROLES[k]));
    const add = selected.filter(k => !member.roles.cache.has(ROLES[k]));
    // Individual PUT/DELETE role endpoints preserve every unrelated staff or player role.
    for (const k of remove) await member.roles.remove(ROLES[k], "GoR eigene Rollenwahl");
    for (const k of add) await member.roles.add(ROLES[k], "GoR eigene Rollenwahl");
    const verified = await guild.members.fetch({ user: member.id, force: true });
    if (Object.keys(SELF_ROLES).some(k => verified.roles.cache.has(ROLES[k]) !== selected.includes(k)))
      throw new UserError("Die Rollenwahl konnte noch nicht vollständig bestätigt werden. Bitte den aktuellen Stand prüfen.");
    store.audit(member.id, "self_roles", member.id);
  }

  async function handle(i: Interaction) {
    if (!i.isRepliable()) return;
    if (i.guildId !== GUILD) { await answer(i, "Dieser Bot gehört zum GoR Network."); return; }
    if (!store.consume(i.id)) return;
    if(i.isButton() && i.customId==="gor44:status") { await i.deferReply({flags:MessageFlags.Ephemeral});await features.status(i);return; }
    // Responding with a modal must be the initial interaction response.
    if (!ready || !client.isReady()) throw new UserError("Der Bot stellt die Verbindung gerade wieder her.");
    if (i.member?.pending) throw new UserError("Bitte bestätige zuerst die Serverregeln.");
    const action = i.isChatInputCommand() ? i.commandName : "customId" in i ? i.customId : "unknown";
    requireStorage(settings, action);
    if(!settings.supportEnabled && ["datenanfrage","beschwerde","einspruch"].includes(action)) {await i.deferReply({flags:MessageFlags.Ephemeral});await features.legal(i);return;}
    const nextModal=features.modalFor(i);if(nextModal && "showModal" in i){await i.showModal(nextModal);return;}
    if (!settings.supportEnabled && ["support", "projektanfrage", "gor:support:v3", "gor:projekt:v3", "gor:kind:v4"].includes(action))
      throw new UserError("Der private Support ist noch nicht aktiviert. Bitte kontaktiere die Networkleitung.");
    if ((i.isButton() && i.customId === "gor:projekt:v3") || (i.isChatInputCommand() && i.commandName === "projektanfrage")) {
      await i.showModal(caseModal("projekt")); return;
    }
    if (i.isStringSelectMenu() && i.customId === "gor:kind:v4" && i.values[0]!=="zahlung") {
      await i.showModal(caseModal(i.values[0])); return;
    }
    // Public panels open a personal card; navigation inside an ephemeral card updates it in place.
    if (i.isMessageComponent() && i.message.flags.has(MessageFlags.Ephemeral)) await i.deferUpdate();
    else await i.deferReply({ flags: MessageFlags.Ephemeral });
    const member = await memberFor(i), guild = member.guild;
    await assertBot(guild);
    if (i.isButton() && [SETUP_CONTROLS.start, SETUP_CONTROLS.pause, SETUP_CONTROLS.resume].includes(i.customId as any)) {
      own(member);
      if (i.customId === SETUP_CONTROLS.start) {
        if (setupRunning) { await answer(i, "Die Gestaltung läuft bereits. /einrichtung zeigt den Stand."); return; }
        void runSetup(true); await answer(i, "Die GoR-Servergestaltung wurde gestartet. /einrichtung zeigt die bestätigten Ergebnisse."); return;
      }
      const active = i.customId === SETUP_CONTROLS.resume;
      if(active && !setupEnabled)throw new UserError("Die Automatik ist durch GOR_AUTO_SETUP=false im Hosting pausiert. /einrichten startet einen einzelnen Abgleich.");
      store.setting("auto_setup_paused", active ? "false" : "true"); store.audit(member.id,"auto_setup_mode",active?"enabled":"paused");
      if(active) {lastSetupAttempt=0;void runSetup();}
      else {clearTimeout(setupWake);setupState=setupRunning?"pausing":"paused";}
      await answer(i,(active?"Die automatische Servergestaltung ist aktiviert.":"Die automatische Servergestaltung ist pausiert.")+
        (settings.storage==="temporary"?" Diese Betriebswahl gilt bis zum nächsten Botstart.":"")+" /einrichtung zeigt den Stand.");
      return;
    }
    if(await features.handle(i,member))return;
    if (i.isButton() && i.customId.startsWith("gor:guide:v5:")) {
      const topic = i.customId.slice("gor:guide:v5:".length);
      if (!(GUIDE_TOPICS as readonly string[]).includes(topic)) throw new UserError("Bitte öffne deinen Einstieg erneut mit /start.");
      await answer(i, "", guideView(topic, CHANNELS)); return;
    }
    if (i.isButton() && i.customId === "gor:roles:open:v5") { await rolesView(i, member); return; }
    if (i.isButton() && i.customId === "gor:own:v5") { await ownCases(i, member); return; }
    if (i.isButton() && i.customId === "gor:audit:v5") { await serverReport(i, member); return; }
    if (i.isButton() && /^gor:queue:v5:\d{1,9}$/.test(i.customId)) {
      await caseBoard(i, member, Number(i.customId.split(":")[3])); return;
    }
    if ((i.isButton() && i.customId === "gor:support:v3") || (i.isChatInputCommand() && i.commandName === "support")) {
      const select = new StringSelectMenuBuilder().setCustomId("gor:kind:v4").setPlaceholder("Wähle dein Anliegen")
        .addOptions(Object.entries(KINDS).map(([value, { title: label }]) => ({ label, value })));
      await answer(i, "Wähle eine Fallart. Allgemeine Fragen passen in den Fragenkanal. Notwendige Angaben landen in deinem privaten Fall; Betreuer erhalten nur zugewiesenen Zugriff. Hinweise: /rechtliches. Zahlungsunterlagen ausschließlich über den externen Zahlungs-Kontakt senden.",
        { components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)] }); return;
    }
    if (i.isModalSubmit() && i.customId === "gor:project:v5") { await serial(() => createCase(i, member, "projekt")); return; }
    if (i.isModalSubmit() && i.customId.startsWith("gor:case:")) { await serial(() => createCase(i, member, i.customId.slice(9))); return; }
    if (i.isStringSelectMenu() && i.customId === "gor:roles:v4") {
      await serial(() => safeSelfRoles(member, i.values)); await answer(i, "Deine Spiel- und Benachrichtigungsrollen sind gespeichert.", { components: communityNavigation() }); return;
    }
    if (i.isButton() && (i.customId.startsWith("gor:publish:") || i.customId.startsWith("gor:cancel:"))) {
      leadership(member); const id = i.customId.split(":")[2];
      await serial(async () => {
        if (i.customId.startsWith("gor:cancel:")) { store.cancel(id, member.id); await answer(i, "Entwurf verworfen.", { components: [], embeds: [] }); return; }
        const op = store.startSend(id, member.id);
        try {
          const ch = await textChannel(guild, CHANNELS[op.target]);
          if (!ch.permissionsFor(guild.roles.everyone).has(P.ViewChannel)) throw new UserError("Der Zielkanal ist nicht mehr öffentlich. Bitte die Leitung informieren.");
          const message = await ch.send({ embeds: [announcementEmbed(op)], allowedMentions: MENTIONS });
          store.finish(id, "sending", message.id);
          const confirmed = await ch.messages.fetch({ message: message.id, force: true });
          if (!sameAnnouncement(op, confirmed)) throw new UserError("Discord bestätigt den Inhalt noch nicht.");
          store.finish(id, "confirmed", message.id); store.audit(member.id, "announcement", id);
          await answer(i, `Veröffentlicht: ${message.url}`, { components: [], embeds: [] });
        } catch (e) { store.finish(id, "needs_review"); store.audit(member.id, "announcement", id, "needs_review"); throw e; }
      }); return;
    }
    if (!i.isChatInputCommand()) throw new UserError("Diese Auswahl ist nicht mehr gültig. Bitte den zugehörigen Befehl erneut öffnen.");
    switch (i.commandName) {
      case "start":
      case "hilfe": await answer(i, "", guideView("start", CHANNELS)); break;
      case "faq": await answer(i, "", faqView(i.options.getString("thema") || undefined, CHANNELS)); break;
      case "status": await features.status(i); break;
      case "unterstuetzen": await answer(i, "", guideView("unterstuetzen", CHANNELS)); break;
      case "rollen": await rolesView(i, member); break;
      case "meine_faelle": await ownCases(i, member); break;
      case "faelle": await caseBoard(i, member, i.options.getInteger("seite") || 1); break;
      case "team": {
        requireTeam(member); const rows = store.queue().filter(c => canHandle(c, member));
        const areas = Object.entries(KINDS).filter(([key]) => eligible(key, member.id, [...member.roles.cache.keys()], guild.ownerId) || (key==="datenschutz" && features.isPrivacyContact(member.id)));
        const summary = areas.map(([key, info]) => `**${info.title}:** ${rows.filter(c => c.kind === key).length}`).join("\n");
        await answer(i, "", { embeds: [embed("GoR · Dein Teamboard", "Deine Zuständigkeiten und die nächsten Aufgaben an einem Ort.")
          .addFields(
            { name: "Offene Anliegen", value: String(rows.length), inline: true },
            { name: "Noch nicht übernommen", value: String(rows.filter(c => c.status === "open" && !c.assignee_id).length), inline: true },
            { name: "Deine Bearbeitung", value: String(rows.filter(c => c.assignee_id === member.id).length), inline: true },
            { name: "Deine Bereiche", value: summary || "Keine Fallzuständigkeit" },
            { name: "Aufmerksamkeit nötig", value: `${rows.filter(c => c.status === "needs_review").length} Fälle müssen geprüft werden.\n${rows.filter(c => now() - c.created >= 86400).length} offene Anliegen wurden vor mindestens 24 Stunden angelegt.` },
            { name: "Dein Werkzeugkasten", value: "/faelle → Übersicht öffnen\n/uebernehmen → einen zuständigen Fall übernehmen\n/schliessen → eigenen oder zugewiesenen Fall abschließen\nProjektphasen ändern: /projektstatus für die Leitung" },
          ).toJSON()], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId("gor:queue:v5:1").setLabel("Meine Fallübersicht").setStyle(ButtonStyle.Primary),
          ).toJSON()] }); break;
      }
      case "projektstatus": await serial(async () => {
        leadership(member);
        const id = i.options.getInteger("fall", true), next=i.options.getString("phase",true), current=store.projectPhase(id);
        if(!canAdvanceProject(current,next))throw new UserError("Dieser Projektphasenwechsel ist nicht vorgesehen.");
        if(next==="pilot") {
          const contact=i.options.getUser("ansprechpartner"),budget=i.options.getNumber("pilotbudget"),agreement=i.options.getString("vereinbarung");
          if(!contact || budget===null || !agreement || !i.options.getBoolean("absprachen_geprueft"))throw new UserError("Vor dem Piloten bitte Ansprechpartner, Budget, Projektvereinbarung und die geprüften Absprachen angeben.");
          await guild.members.fetch({user:contact.id,force:true});
          features.state.projectCheck(id,contact.id,cents(budget),publicUrl(agreement),member.id,i.options.getInteger("pilottage")||30);
        }
        if(next==="aufgenommen" && (!features.state.projectReady(id) || !i.options.getBoolean("pilot_ausgewertet")))throw new UserError("Vor der Aufnahme müssen Pilotvereinbarung und ausdrücklich bestätigte Auswertung vorliegen.");
        const phase=store.setProjectPhase(id,next,member.id),pilot=features.state.projectReady(id);
        await answer(i, `**Projektanfrage #${id}: ${PROJECT_PHASES[phase]}**\nDer Stand ist für den Anfragenden unter /meine_faelle sichtbar.${phase==="pilot" && pilot?`\nPilot-Auswertung vorgesehen: <t:${Math.floor(pilot.pilot_end)}:d>`:""}\nDieser Schritt überträgt keine Server, Konten, Verträge oder Nutzungsrechte.`);
      }); break;
      case "uebernehmen": await serial(async () => {
        const c = store.get(i.options.getInteger("fall", true));
        if (!canHandle(c, member) || c.opener_id === member.id) throw new UserError("Du bist kein unbeteiligter zuständiger Bearbeiter dieses Falls.");
        if (c.status !== "open" || c.assignee_id) throw new UserError("Der Fall ist bereits zugewiesen oder muss geprüft werden.");
        const ch = await caseChannel(guild, c); store.change(c.id, { assignee_id: member.id, status: "assigning" });
        try {
          await ch.permissionOverwrites.edit(member, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true }, { reason: "GoR Fallübernahme" });
          const saved = store.change(c.id, { status: "open" }), verified = await caseChannel(guild, saved);
          const overwrite = verified.permissionOverwrites.cache.get(member.id);
          if (!overwrite?.allow.has([P.ViewChannel, P.SendMessages, P.ReadMessageHistory])) throw new UserError("Der Bearbeiterzugriff ist noch nicht bestätigt.");
          store.audit(member.id, "case_claim", String(c.id));
        } catch (e) { store.change(c.id, { status: "needs_review" }); throw e; }
        await answer(i, `Du bearbeitest jetzt <#${ch.id}>. Persönliche Beteiligung bitte der Leitung melden.`);
      }); break;
      case "schliessen": await serial(async () => {
        const c = store.get(i.options.getInteger("fall", true));
        if (!mayClose(c, member.id, guild.ownerId)) throw new UserError("Nur Anfragender, zugewiesener Bearbeiter oder Inhaber können den Fall abschließen.");
        if(["datenschutz","beschwerde","einspruch"].includes(c.kind) && c.opener_id!==member.id && !canHandle(c,member))throw new UserError("Ein beteiligter oder nicht zuständiger Bearbeiter darf diesen Fall nicht entscheiden.");
        if (c.status !== "open") throw new UserError("Dieser Fall ist nicht offen oder muss geprüft werden.");
        const ch = await caseChannel(guild, c); store.change(c.id, { status: "closing" });
        try {
          for (const id of new Set([c.opener_id, c.assignee_id].filter(Boolean) as string[]))
            await ch.permissionOverwrites.edit(id, { ViewChannel: true, SendMessages: false, ReadMessageHistory: true }, { type: OverwriteType.Member, reason: "GoR Fallabschluss" });
          const confirmed = await caseChannel(guild, c);
          for (const id of [c.opener_id, c.assignee_id].filter(Boolean) as string[])
            if (!confirmed.permissionOverwrites.cache.get(id)?.deny.has(P.SendMessages)) throw new UserError("Der Schreibschutz ist noch nicht bestätigt.");
          await ch.send({ content: "**Abgeschlossen.** Der Verlauf bleibt für die bisherigen Beteiligten lesbar. Die Leitung prüft die weitere Aufbewahrung.", allowedMentions: MENTIONS });
          store.change(c.id, { status: "closed" }); features.state.close(c.id); store.audit(member.id, "case_close", String(c.id));
        } catch (e) { store.change(c.id, { status: "needs_review" }); throw e; }
        await answer(i, "Der Fall ist abgeschlossen und für die Beteiligten schreibgeschützt. Die Aufbewahrung wird getrennt geprüft; dies bestätigt keine bereits ausgeführte Löschung oder vollständige Datenschutzauskunft.");
      }); break;
      case "fall_zuordnen": await serial(async () => {
        own(member); const c = store.get(i.options.getInteger("fall", true));
        if (!["creating", "assigning", "closing", "needs_review"].includes(c.status)) throw new UserError("Dieser Fall benötigt keine Wiederaufnahme.");
        const ch = await textChannel(guild, i.options.getChannel("kanal", true).id); checkPrivacy(ch, c);
        try {
          for (const id of new Set([c.opener_id, c.assignee_id].filter(Boolean) as string[]))
            await ch.permissionOverwrites.edit(id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }, { type: OverwriteType.Member, reason: "GoR bestätigte Wiederaufnahme" });
          const saved = store.change(c.id, { channel_id: ch.id, status: "open" }); await caseChannel(guild, saved);features.state.reopen(c.id);
        } catch (e) { store.change(c.id, { status: "needs_review" }); throw e; }
        store.audit(member.id, "case_recover", String(c.id)); await answer(i, `Bestehenden Kanal bestätigt: <#${ch.id}>.`);
      }); break;
      case "supportpanel": await serial(async () => {
        own(member); const ch = await textChannel(guild, CHANNELS.support), saved = store.setting("panel_message_id");
        const payload = { ...supportView(), allowedMentions: MENTIONS };
        if (saved === "pending") throw new UserError("Die letzte Anlage ist unklar. Bitte die vorhandene Nachricht mit /panel_zuordnen bestätigen.");
        let message;
        if (saved) {
          message = await ch.messages.fetch(saved); if (message.author.id !== APPLICATION) throw new UserError("Das gespeicherte Bedienfeld gehört nicht zum Bot.");
          await message.edit(payload);
        } else {
          store.setting("panel_message_id", "pending"); message = await ch.send(payload);
          store.setting("panel_message_id", message.id);
        }
        const check = await ch.messages.fetch({ message: message.id, force: true });
        if (!sameCommunityPanel(check, supportView(), APPLICATION)) throw new UserError("Der Bedienfeldinhalt ist noch nicht bestätigt.");
        store.audit(member.id, "panel_publish", message.id); await answer(i, `Supportbedienfeld: ${message.url}`);
      }); break;
      case "communitypanel": await serial(async () => {
        own(member); const ch = await textChannel(guild, CHANNELS.start), me = await assertBot(guild);
        if (!ch.permissionsFor(guild.roles.everyone)?.has(P.ViewChannel)
            || !ch.permissionsFor(me)?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks, P.ReadMessageHistory]))
          throw new UserError("Der Startkanal muss für Mitglieder sichtbar und für den Bot beschreibbar sein.");
        const saved = store.setting("community_panel_message_id"), payload = { ...communityHub(CHANNELS), allowedMentions: MENTIONS };
        if (saved === "pending") throw new UserError("Die letzte Anlage ist unklar. Bitte das vorhandene Menü mit /communitypanel_zuordnen bestätigen.");
        let message;
        if (saved) {
          message = await ch.messages.fetch(saved);
          if (message.author.id !== APPLICATION) throw new UserError("Das gespeicherte Community-Menü gehört nicht zum Bot.");
          await message.edit(payload);
        } else {
          store.setting("community_panel_message_id", "pending"); message = await ch.send(payload);
          store.setting("community_panel_message_id", message.id);
        }
        const check = await ch.messages.fetch({ message: message.id, force: true });
        if (!sameCommunityPanel(check, communityHub(CHANNELS), APPLICATION)) throw new UserError("Das Community-Menü ist noch nicht vollständig bestätigt. Die bestehende Nachricht prüfen.");
        store.audit(member.id, "community_panel_publish", message.id); await answer(i, `Dein zentrales Community-Menü ist bereit: ${message.url}`);
      }); break;
      case "communitypanel_zuordnen": await serial(async () => {
        own(member); const id = i.options.getString("nachricht", true);
        if (!/^\d{15,22}$/.test(id)) throw new UserError("Bitte die konkrete Nachrichten-ID verwenden.");
        const ch = await textChannel(guild, CHANNELS.start), message = await ch.messages.fetch(id);
        if (!sameCommunityPanel(message, communityHub(CHANNELS), APPLICATION)) throw new UserError("Autor, Inhalt und Schaltflächen passen nicht zum aktuellen GoR Community-Menü.");
        store.setting("community_panel_message_id", id); store.audit(member.id, "community_panel_recover", id);
        await answer(i, `Das vorhandene Community-Menü ist bestätigt: ${message.url}`);
      }); break;
      case "einrichtung": {
        leadership(member);
        const issues = setupReport?.issues || [], pending = new SetupJournal(store.db).pending();
        const mode = !setupEnabled ? "Über die Laufzeitkonfiguration pausiert" : store.setting("auto_setup_paused") === "true" ? "Vom Inhaber pausiert" : layoutPolicy.label + " · beim Start, bei Änderungen und alle 15 Minuten";
        const view = embed("GoR · Automatische Serverpflege", `**Betrieb:** ${mode}\n**Aktueller Stand:** ${setupRunning ? "Einrichtung läuft" : setupState}`)
          .addFields({ name: "Verwaltete Bereiche", value: "16 Rollen · 10 Kategorien · 41 Kanäle · 11 Infotafeln\nDazu Community-Profil, AFK, Einstieg, Rollenwahl und Erwähnungsschutz." });
        if (setupReport) view.addFields({ name: "Letzter Lauf", value: `<t:${Math.floor(setupReport.at / 1000)}:R>\n${setupReport.created} angelegt · ${setupReport.updated} aktualisiert · ${setupReport.unchanged} bereits passend` });
        if (issues.length) view.addFields({ name: `${issues.length} Punkte prüfen`, value: issues.slice(0, 6).map(item => `**${item.key}**\n${SETUP_ISSUES[item.code] || SETUP_ISSUES.unexpected_error}`).join("\n\n") });
        if (pending.length) view.addFields({ name: "Unklare Anlagen", value: pending.slice(0, 8).map(item => `\`${item.key}\``).join("\n") + "\nInhaber: vorhandenen Eintrag mit /einrichtung_zuordnen bestätigen." });
        view.addFields({name:"Gestaltungsmodus",value:layoutPolicy.notice},{name:"Kontakt, Datenschutz & Betrieb",value:features.readiness()});
        await answer(i, "", { embeds: [view.toJSON()],components:member.id===guild.ownerId?[...setupButtons(store.setting("auto_setup_paused")==="true"),...features.settingsButtons()]:[] }); break;
      }
      case "einrichten": {
        own(member); if (setupRunning) { await answer(i, "Die Einrichtung läuft bereits. /einrichtung zeigt den Stand."); break; }
        void runSetup(true); await answer(i, "Die GoR-Einrichtung wurde gestartet. Der Bot bleibt dabei erreichbar. Den Stand findest du mit /einrichtung."); break;
      }
      case "einrichtung_automatik": {
        own(member); const active = i.options.getBoolean("aktiv", true);
        if(active && !setupEnabled)throw new UserError("Die Automatik ist durch GOR_AUTO_SETUP=false im Hosting pausiert. /einrichten startet einen einzelnen Abgleich.");
        const protectedKey=i.options.getString("schutz");if(protectedKey)setProtection(store,protectedKey,i.options.getInteger("stunden")??24);
        const person=i.options.getUser("datenschutz_person");
        if(person){await guild.members.fetch({user:person.id,force:true});let list:string[]=[];try{list=JSON.parse(store.setting("privacy_contacts_json_v44")||"[]");}catch{}
          list=i.options.getBoolean("kontakt_entfernen")?list.filter(id=>id!==person.id):[...new Set([...list,person.id])];
          if(list.length>4)throw new UserError("Bitte höchstens vier konkret benannte Datenschutzkontakte verwenden.");
          store.setting("privacy_contacts_json_v44",JSON.stringify(list));store.setting("privacy_contacts_v44",list.join(","));}
        store.setting("auto_setup_paused", active ? "false" : "true"); store.audit(member.id, "auto_setup_mode", active ? "enabled" : "paused");
        if (active) { lastSetupAttempt = 0; void runSetup(); }
        else setupState = setupRunning ? "pausing" : "paused";
        await answer(i, active ? "Die automatische GoR-Pflege ist aktiviert. /einrichtung zeigt den Stand." : "Die automatische Pflege ist pausiert. Ein bereits laufender Einrichtungsschritt wird noch abgeschlossen."); break;
      }
      case "einrichtung_zuordnen": await serial(async () => {
        own(member); const key = i.options.getString("schluessel", true), id = i.options.getString("id", true);
        try { await adoptSetupResource({ guild, application: APPLICATION, target: GUILD, maps: setupMaps, storage: store }, key, id); }
        catch (error) { throw new UserError(SETUP_ISSUES[issueCode(error)] || SETUP_ISSUES.unexpected_error); }
        store.audit(member.id, "auto_setup_bind", key); lastSetupAttempt = 0;
        await answer(i, `Vorhandenen GoR-Eintrag bestätigt: ${key}. Die Automatik verwendet künftig diese ID.`);
      }); break;
      case "einrichtung_freigeben": await serial(async () => {
        own(member); const key = i.options.getString("schluessel", true);
        if (!resourceKnown(key) || !i.options.getBoolean("nicht_vorhanden", true)) throw new UserError("Eine neue Anlage darf erst nach der Prüfung freigegeben werden, dass der frühere Eintrag nicht existiert.");
        try { new SetupJournal(store.db).clearAbsent(key); } catch { throw new UserError("Für diesen Schlüssel gibt es keine unklare Anlage."); }
        store.audit(member.id, "auto_setup_release", key); lastSetupAttempt = 0;
        await answer(i, `Die sicher nicht erfolgte Anlage ist freigegeben: ${key}. Die Automatik kann sie beim nächsten Lauf ergänzen.`);
      }); break;
      case "panel_zuordnen": await serial(async () => {
        own(member); const id = i.options.getString("nachricht", true);
        if (!/^\d{15,22}$/.test(id)) throw new UserError("Bitte die konkrete Nachrichten-ID verwenden.");
        const ch = await textChannel(guild, CHANNELS.support), m = await ch.messages.fetch(id);
        const ids = m.components.flatMap(row => "components" in row ? row.components.map((c: any) => c.customId) : []).sort();
        if (m.author.id !== APPLICATION || (!sameCommunityPanel(m,supportView(),APPLICATION) && JSON.stringify(ids) !== JSON.stringify(["gor:projekt:v3", "gor:support:v3"]))) throw new UserError("Das ist kein passendes GoR Supportbedienfeld.");
        store.setting("panel_message_id", id); store.audit(member.id, "panel_recover", id); await answer(i, "Das vorhandene Supportbedienfeld ist bestätigt.");
      }); break;
      case "serverpruefen": await serverReport(i, member); break;
      case "ankuendigung": {
        leadership(member); const op = store.draft(member.id, i.options.getString("ziel", true), i.options.getString("titel", true), i.options.getString("text", true));
        const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId("gor:publish:" + op.id).setLabel("Jetzt veröffentlichen").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("gor:cancel:" + op.id).setLabel("Verwerfen").setStyle(ButtonStyle.Secondary));
        await answer(i, `**Private Vorschau** · Ziel: <#${CHANNELS[op.target]}>\nGültig für 15 Minuten. Nur du kannst diesen Entwurf bestätigen. Benachrichtigungen sind ausgeschaltet.`, { embeds: [announcementEmbed(op)], components: [buttons] }); break;
      }
      case "vorgaenge": {
        own(member); const rows = store.db.query("SELECT id,target,created FROM operations WHERE state='needs_review' ORDER BY created LIMIT 10").all() as any[];
        await answer(i, rows.map(o => `\`${o.id}\` · ${ANNOUNCE_TARGETS[o.target as keyof typeof ANNOUNCE_TARGETS]} · <t:${Math.floor(o.created)}:f>`).join("\n") || "Keine unbestätigten Veröffentlichungen."); break;
      }
      case "vorgang_zuordnen": await serial(async () => {
        own(member); const op = store.operation(i.options.getString("vorgang", true)), id = i.options.getString("nachricht", true);
        if (op.state !== "needs_review" || !/^\d{15,22}$/.test(id)) throw new UserError("Vorgang oder Nachrichten-ID passen nicht.");
        const ch = await textChannel(guild, CHANNELS[op.target]), m = await ch.messages.fetch(id);
        if ((op.discord_id && op.discord_id !== id) || m.createdTimestamp / 1000 < op.created || !sameAnnouncement(op, m)) throw new UserError("Autor, Zeitpunkt oder Inhalt stimmen nicht mit dem Entwurf überein.");
        store.finish(op.id, "confirmed", m.id); store.audit(member.id, "announcement_recover", op.id); await answer(i, `Vorhandene Veröffentlichung bestätigt: ${m.url}`);
      }); break;
      case "backup": own(member); { const file = store.backup(true); store.audit(member.id, "manual_backup", file!); await answer(i, "Die Bot-Datenbank wurde auf dem dauerhaften Volume gesichert. Sie wurde nicht in Discord hochgeladen."); } break;
      default: throw new UserError("Dieser Befehl gehört zu einer anderen Bot-Version. Bitte /hilfe öffnen.");
    }
  }
  client.on(Events.InteractionCreate, i => {
    void handle(i).catch(async e => {
      safeLog("interaction_failed", typeof e?.code === "number" ? e.code : undefined);
      if (e instanceof UserError && e.code === "storage_required") safeLog("storage_required");
      if (i.isRepliable()) try {
        await answer(i, e instanceof PublicError ? e.message : "Der Vorgang konnte nicht bestätigt werden. Bitte die Networkleitung informieren. Unklare Änderungen werden nicht auf Verdacht wiederholt.");
      } catch { safeLog("interaction_response_failed"); }
    }).finally(() => { try { store.backup(); store.cleanup(); } catch { safeLog("maintenance_failed"); } });
  });
  async function registerCommands() {
    if (stopped || !commandTokenReady) return;
    try {
      const report = await commands.sync();
      if (report && !stopped) console.log(JSON.stringify({ at: new Date().toISOString(), event: "commands_registered", confirmed: report.confirmed, total: commandDefinitions().length, guild: GUILD }));
    } catch (error) {
      if (!stopped) console.error(JSON.stringify({ at: new Date().toISOString(), event: "commands_registration_failed_retrying",
        phase: commands.phase, confirmed: commands.confirmed, total: commandDefinitions().length, ...errorDiagnostic(error) }));
    }
  }
  async function runSetup(force = false,before?:()=>Promise<void>):Promise<SetupReport|undefined> {
    if (stopped || !verified || !client.isReady() || setupRunning) return;
    if (!force && (!setupEnabled || store.setting("auto_setup_paused") === "true")) { setupState = "paused"; return; }
    const delay = setupReport?.issues.some(item => item.code === "lease_busy") ? 60_000 : setupReport?.issues.length ? 300_000 : 900_000;
    if (!force && Date.now() - lastSetupAttempt < delay) return;
    setupRunning = true; setupState = "running"; lastSetupAttempt = Date.now(); safeLog("auto_setup_started");
    try {
      setupReport = await serial(async () => {await before?.();return (options.setupRunner || reconcileServer)({
        guild: await client.guilds.fetch(GUILD), application: APPLICATION, target: GUILD, maps: setupMaps, storage: store,
        legal:features.publicLinks(), allowCreate:layoutPolicy.allowCreate,
        stopped: () => stopped || (!force && store.setting("auto_setup_paused") === "true"),
      });});
      setupState = !force && store.setting("auto_setup_paused") === "true" ? "paused" : setupReport.status;
      store.setting("auto_setup_report", JSON.stringify(setupReport));
      console.log(JSON.stringify({ at: new Date().toISOString(), event: "auto_setup_finished", created: setupReport.created, updated: setupReport.updated, issues: setupReport.issues.length }));
      return setupReport;
    } catch (error) { setupState = "attention"; console.error(JSON.stringify({ at: new Date().toISOString(), event: "auto_setup_failed", code: issueCode(error) })); if(before)throw error; }
    finally { setupRunning = false; }
  }
  function requestLayoutRefresh(guildId: string | undefined, kind: "role" | "channel" | "guild", id: string) {
    if(stopped || !verified || setupRunning || guildId!==GUILD || !setupEnabled || store.setting("auto_setup_paused")==="true") return;
    const known=kind==="guild" || (kind==="role"?Object.values(ROLES):[...Object.values(CATEGORIES),...Object.values(CHANNELS)]).includes(id);
    if(!known) return;
    clearTimeout(setupWake);
    setupWake=setTimeout(()=>{lastSetupAttempt=0;void runSetup();},options.setupDebounceMs??5000);
    setupWake.unref();
  }
  client.on(Events.GuildRoleUpdate, (_previous, role) => requestLayoutRefresh(role.guild.id,"role",role.id));
  client.on(Events.GuildRoleDelete, role => requestLayoutRefresh(role.guild.id,"role",role.id));
  client.on(Events.ChannelUpdate, (_previous, channel) => requestLayoutRefresh("guild" in channel?channel.guild.id:undefined,"channel",channel.id));
  client.on(Events.ChannelDelete, channel => requestLayoutRefresh("guild" in channel?channel.guild.id:undefined,"channel",channel.id));
  client.on(Events.GuildUpdate, (_previous, guild) => requestLayoutRefresh(guild.id,"guild",guild.id));
  client.on(Events.ClientReady, () => {
    safeLog("discord_gateway_ready");
    void serial(async () => {
      ready = false; state = "checking_application"; safeLog("discord_application_checking");
      await client.application!.fetch();
      validateIdentity(client.user?.id, client.application?.id, GUILD);
      safeLog("discord_application_verified");
      state = "checking_guild"; safeLog("discord_guild_checking");
      const guild = await client.guilds.fetch(GUILD); await assertBot(guild);
      safeLog("discord_guild_verified");
      // Being online must not depend on optional storage, administrator warnings or command sync.
      try { store.backup(); } catch { safeLog("backup_failed"); }
      verified = true; ready = true; state = "ready"; lastHealthy = Date.now();
      clearTimeout(startupDeadline);
      client.user!.setPresence({ activities: [{ name: "/hilfe · GoR Network", type: ActivityType.Watching }], status: "online" });
      safeLog("discord_ready");
      void features.maintenance().catch(()=>safeLog("community44_maintenance_attention"));
      void registerCommands();
      void runSetup();
    }).catch(error => { logFailure("startup_check_failed", error); void shutdown(1); });
  });
  const token = readToken(env);
  if (!token) {
    state = "token_missing";
    console.error(JSON.stringify({ at: new Date().toISOString(), event: "configuration_token_missing", hint: "Bot-Token als GOR_DISCORD_BOT_TOKEN, DISCORD_TOKEN, DISCORD_BOT_TOKEN, BOT_TOKEN oder TOKEN hinterlegen." }));
    await shutdown(1); return;
  }
  console.log(JSON.stringify({ at: new Date().toISOString(), event: "configuration_token_found", source: token.key }));
  client.rest.setToken(token.value); commandTokenReady = true;
  safeLog("commands_registration_starting");
  void registerCommands();
  startupDeadline = setTimeout(() => {
    if (verified || stopped) return;
    state = "startup_timeout"; logFailure("discord_startup_timeout", { code: "startup_timeout" }); void shutdown(1);
  }, options.startupTimeoutMs ?? 120_000);
  startupDeadline.unref();
  maintenance = setTimeout(maintain, 60_000); maintenance.unref();
  // Never log the token or a Discord HTTP request/response body.
  safeLog("discord_connecting");
  state = "connecting";
  try { await client.login(token.value); } catch (error) { logFailure("discord_login_failed", error); await shutdown(1); }
}

if (import.meta.main) {
  try { await main(); } catch (error) { logFailure("service_start_failed", error); process.exitCode = 1; }
}

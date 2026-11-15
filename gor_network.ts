/** GoR Network bot, v4.1.0. Repository and container deployment (Bun).
 * No tokens, message-content intent, blanket command deletion or automatic server rebuild.
 * Requires one replica and a persistent volume at GOR_DATA_DIR=/data.
 */
import { Database } from "bun:sqlite";
import { mkdirSync, chmodSync, writeFileSync, renameSync, readdirSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  Client, GatewayIntentBits, Events, PermissionFlagsBits as P, ChannelType,
  SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  MessageFlags, ActivityType, GuildMember, TextChannel, OverwriteType,
  type Interaction, type Guild, type RepliableInteraction,
} from "discord.js";

export const VERSION = "4.1.0";
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
};
export const SELF_ROLES: Record<string, string> = {
  "cw-spieler": "Clone Wars · Spieler", "ping-netzwerk": "Neuigkeiten zum Network",
  "ping-events": "Community-Events", "ping-cw": "Clone Wars · Neuigkeiten", "ping-entwicklung": "Entwicklungsupdates",
};
const ANNOUNCE_TARGETS = { neuigkeiten: "Network-Neuigkeiten", termine: "Community-Termine", "cw-neuigkeiten": "Clone Wars" };
const MENTIONS = { parse: [] as [], repliedUser: false };
const COLOR = 0x21cce2;
const now = () => Date.now() / 1000;
export class UserError extends Error {}
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
      const r = this.db.query("INSERT INTO cases(guild_id,opener_id,kind,status,created,updated) VALUES (?,?,?,'creating',?,?)").run(GUILD, openerId, kind, timestamp, timestamp);
      return this.get(Number(r.lastInsertRowid));
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
    this.db.query("DELETE FROM audit WHERE at<?").run(now() - 86400 * 180);
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
      for (const prefix of ["gor-auto-", "gor-manual-"])
        for (const file of files.filter(f => f.startsWith(prefix)).slice(7)) unlinkSync(join(dir, file));
      this.lastBackup = timestamp; this.backupHealthy = true;
      if (manual) this.setting("manual_backup_at", String(timestamp));
      return name;
    } catch (e) { this.backupHealthy = false; throw e; }
  }
  close() { this.db.close(); }
}

export function commandDefinitions() {
  const command = (name: string, description: string) => new SlashCommandBuilder().setName(name).setDescription(description);
  const caseNumber = (b: SlashCommandBuilder) => b.addIntegerOption(o => o.setName("fall").setDescription("Fallnummer").setMinValue(1).setRequired(true));
  return [
    command("hilfe", "Dein Weg zu Spielen, Mitspielern und Hilfe."),
    command("status", "Verbindung und Funktionen des GoR Bots prüfen."),
    command("support", "Privates Anliegen an die zuständige Betreuung richten."),
    command("projektanfrage", "Ein Projekt für das GoR Network vorstellen."),
    command("rollen", "Deine Spiel- und Benachrichtigungsrollen selbst auswählen."),
    command("unterstuetzen", "Informationen zur freiwilligen Unterstützung von GoR."),
    command("faelle", "Deine zuständigen offenen Supportfälle anzeigen."),
    caseNumber(command("uebernehmen", "Einen zuständigen Fall als unbeteiligter Bearbeiter übernehmen.")),
    caseNumber(command("schliessen", "Einen eigenen oder zugewiesenen Fall abschließen.")),
    caseNumber(command("fall_zuordnen", "Inhaber: bestehenden Kanal nach einer unklaren Aktion bestätigen."))
      .addChannelOption(o => o.setName("kanal").setDescription("Bestehender Fallkanal").addChannelTypes(ChannelType.GuildText).setRequired(true)),
    command("supportpanel", "Inhaber: das Supportbedienfeld veröffentlichen oder aktualisieren."),
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
export function commandShape(definition: any): string {
  const option = (o: any): any => {
    const shape: any = { type: o.type, name: o.name, description: o.description, required: !!o.required };
    for (const [snake, camel] of [["min_value", "minValue"], ["max_value", "maxValue"], ["min_length", "minLength"], ["max_length", "maxLength"], ["channel_types", "channelTypes"]]) {
      const value = o[snake] ?? o[camel]; if (value !== undefined) shape[snake] = value;
    }
    if (o.choices?.length) shape.choices = o.choices.map((c: any) => ({ name: c.name, value: c.value }));
    if (o.options?.length) shape.options = o.options.map(option);
    return shape;
  };
  return JSON.stringify([definition.name, definition.description, (definition.options || []).map(option)]);
}
async function answer(i: RepliableInteraction, content: string, extra: Record<string, any> = {}) {
  const options = { content, allowedMentions: MENTIONS, ...extra };
  if (i.deferred || i.replied) await i.editReply(options);
  else await i.reply({ ...options, flags: MessageFlags.Ephemeral });
}
function safeLog(event: string, code?: unknown) {
  // Never serialize Error objects: Discord errors may contain request bodies or credentials.
  console.log(JSON.stringify({ at: new Date().toISOString(), event, ...(typeof code === "number" ? { code } : {}) }));
}
function own(member: GuildMember) {
  if (member.id !== member.guild.ownerId) throw new UserError("Diese Funktion führt der Serverinhaber aus.");
}
function leadership(member: GuildMember) {
  if (member.id !== member.guild.ownerId && !["networkleitung", "communityleitung"].some(k => member.roles.cache.has(ROLES[k])))
    throw new UserError("Für diese Funktion fehlt die Zuständigkeit in der Networkleitung.");
}
export function validateIdentity(userId: string | undefined, appId: string | undefined, guildId: string, admin: boolean) {
  if (userId !== APPLICATION || appId !== APPLICATION || guildId !== GUILD) throw new UserError("Anwendung oder Zielserver passen nicht zu GoR.");
  if (admin) throw new UserError("Bitte das Administratorrecht des Bots durch die benötigten Einzelrechte ersetzen.");
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
function caseModal(kind: string) {
  if (!Object.hasOwn(KINDS, kind)) throw new UserError("Unbekannte Fallart.");
  return new ModalBuilder().setCustomId("gor:case:" + kind).setTitle(KINDS[kind].title).addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("summary")
      .setLabel(kind === "projekt" ? "Projekt und Spiel" : "Worum geht es?").setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(true)),
    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("details")
      .setLabel(kind === "projekt" ? "Stand und gewünschte Zusammenarbeit" : "Ablauf und wichtige Einzelheiten")
      .setPlaceholder("Keine Passwörter, Tokens oder privaten Mitgliederlisten senden.").setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(true)),
  );
}

export function healthResponse(path: string, ready: boolean, dbOk: boolean, state: string) {
  const status = path === "/live" ? 200 : (path === "/health" || path === "/ready") ? (ready && dbOk ? 200 : 503) : 404;
  return Response.json({ service: "gor-network", version: VERSION, status: status === 404 ? "not_found" : path === "/live" ? "alive" : ready && dbOk ? "ready" : state },
    { status, headers: { "Cache-Control": "no-store" } });
}

export async function main() {
  process.umask(0o077);
  const directory = Bun.env.GOR_DATA_DIR || Bun.env.RAILWAY_VOLUME_MOUNT_PATH || "./betrieb";
  if (Bun.env.RAILWAY_ENVIRONMENT_ID && (!Bun.env.RAILWAY_VOLUME_MOUNT_PATH || resolve(directory) !== resolve(Bun.env.RAILWAY_VOLUME_MOUNT_PATH)))
    throw new UserError("Ein dauerhaftes Volume am konfigurierten Datenverzeichnis fehlt.");
  const store = new Store(directory);
  const client = new Client({ intents: [GatewayIntentBits.Guilds], allowedMentions: MENTIONS,
    rest: { retries: 0, timeout: 15_000 } });
  let ready = false, state = "starting", stopped = false, lastHealthy = Date.now();
  let maintenance: ReturnType<typeof setTimeout> | undefined;
  const server = Bun.serve({ hostname: "0.0.0.0", port: Number(Bun.env.PORT || 8080),
    fetch(request) { let dbOk = false; try { dbOk = store.health(); } catch {}
      return healthResponse(new URL(request.url).pathname, ready && client.isReady(), dbOk, state); } });
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T,>(fn: () => Promise<T>) => {
    const task = queue.then(fn); queue = task.catch(() => {}); return task;
  };
  async function shutdown(code: number) {
    if (stopped) return; stopped = true; ready = false; state = "stopping"; clearTimeout(maintenance);
    const force = setTimeout(() => process.exit(code || 1), 12_000); force.unref();
    await queue; await client.destroy();
    try { store.backup(); } catch { safeLog("backup_failed"); }
    server.stop(true); store.close(); clearTimeout(force); process.exit(code);
  }
  process.once("SIGTERM", () => { void shutdown(0); }); process.once("SIGINT", () => { void shutdown(0); });
  process.on("unhandledRejection", () => { safeLog("unhandled_rejection"); void shutdown(1); });
  client.on(Events.Error, () => safeLog("discord_connection_error"));
  client.on(Events.ShardDisconnect, () => { ready = false; state = "reconnecting"; });
  client.on(Events.ShardResume, () => { if (state === "reconnecting") { ready = true; state = "ready"; } });
  client.on(Events.ShardError, () => safeLog("discord_gateway_error"));
  function maintain() {
    if (stopped) return;
    try { store.backup(); store.cleanup(); } catch { safeLog("maintenance_failed"); }
    if (ready && client.isReady()) lastHealthy = Date.now();
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
    validateIdentity(client.user?.id, client.application?.id, guild.id, me.permissions.has(P.Administrator)); return me;
  }
  function canHandle(c: Case, member: GuildMember) {
    return eligible(c.kind, member.id, [...member.roles.cache.keys()], member.guild.ownerId);
  }
  async function createCase(i: any, member: GuildMember, kind: string) {
    if (Bun.env.GOR_SUPPORT_ENABLED !== "true") throw new UserError("Der private Support ist noch nicht aktiviert. Bitte kontaktiere die Networkleitung.");
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
    try {
      const ch = await guild.channels.create({ name: `fall-${String(c.id).padStart(4, "0")}`, type: ChannelType.GuildText,
        parent: CATEGORIES.hilfe, topic: `gor-case:${c.id}`, reason: "GoR privater Supportfall",
        permissionOverwrites: [
          { id: GUILD, type: OverwriteType.Role, deny: [P.ViewChannel] },
          { id: APPLICATION, type: OverwriteType.Member, allow: needed },
          { id: member.id, type: OverwriteType.Member, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.EmbedLinks] },
        ] });
      const saved = store.change(c.id, { channel_id: ch.id, status: "open" });
      const verified = await caseChannel(guild, saved);
      await verified.send({ embeds: [embed(`${KINDS[kind].title} · Fall ${c.id}`,
        `**${i.fields.getTextInputValue("summary")}**\n\n${i.fields.getTextInputValue("details")}\n\nDu und zugewiesene Bearbeiter sehen diesen Fall. Inhaber und Administratoren können technisch ebenfalls zugreifen. Bitte keine Passwörter oder Tokens senden. Eine Betreuung rund um die Uhr wird nicht versprochen.`)], allowedMentions: MENTIONS });
      store.audit(member.id, "case_create", String(c.id));
      await answer(i, `Dein privater Fall ist angelegt: <#${verified.id}>. Eine zuständige Person kann ihn übernehmen.`);
    } catch (e) { store.change(c.id, { status: "needs_review" }); store.audit(member.id, "case_create", String(c.id), "needs_review"); throw e; }
  }
  async function safeSelfRoles(member: GuildMember, selected: string[]) {
    roleKeys(selected); const guild = member.guild, me = await assertBot(guild);
    if (!me.permissions.has(P.ManageRoles)) throw new UserError("Dem Bot fehlt die Rollenverwaltung.");
    await guild.roles.fetch(); const channels = await guild.channels.fetch();
    const publicParents = new Set(["ankommen", "community", "spielen", "unterstuetzung", "hilfe", "clonewars"].map(k => CATEGORIES[k]));
    const harmless = P.ViewChannel | P.ReadMessageHistory | P.SendMessages | P.EmbedLinks | P.AttachFiles | P.Connect | P.Speak | P.UseVAD;
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
    // Responding with a modal must be the initial interaction response.
    if (!ready || !client.isReady()) throw new UserError("Der Bot stellt die Verbindung gerade wieder her.");
    if (i.member?.pending) throw new UserError("Bitte bestätige zuerst die Serverregeln.");
    if ((i.isButton() && i.customId === "gor:projekt:v3") || (i.isChatInputCommand() && i.commandName === "projektanfrage")) {
      await i.showModal(caseModal("projekt")); return;
    }
    if (i.isStringSelectMenu() && i.customId === "gor:kind:v4") {
      await i.showModal(caseModal(i.values[0])); return;
    }
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const member = await memberFor(i), guild = member.guild;
    await assertBot(guild);
    if ((i.isButton() && i.customId === "gor:support:v3") || (i.isChatInputCommand() && i.commandName === "support")) {
      const select = new StringSelectMenuBuilder().setCustomId("gor:kind:v4").setPlaceholder("Wähle dein Anliegen")
        .addOptions(Object.entries(KINDS).map(([value, { title: label }]) => ({ label, value })));
      await answer(i, "Wähle eine Fallart. Allgemeine Fragen passen auch in den Fragenkanal. Persönliche Zahlungsdetails bleiben im privaten Kontakt.",
        { components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)] }); return;
    }
    if (i.isModalSubmit() && i.customId.startsWith("gor:case:")) { await serial(() => createCase(i, member, i.customId.slice(9))); return; }
    if (i.isStringSelectMenu() && i.customId === "gor:roles:v4") {
      await serial(() => safeSelfRoles(member, i.values)); await answer(i, "Deine Spiel- und Benachrichtigungsrollen sind gespeichert."); return;
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
      case "hilfe": await answer(i, "**Willkommen bei GoR Network**\nSpiele und Projekte: <#" + CHANNELS.projekte + ">\nMitspieler: <#" + CHANNELS.mitspielersuche + ">\nHilfe: /support · Eigene Rollen: /rollen\nEin Projekt für das Network vorstellen: /projektanfrage\nDu gehörst auch ohne Zahlung zu GoR."); break;
      case "status": await answer(i, `**GoR Bot v${VERSION}**\nDiscord verbunden · Datenbank erreichbar\nPrivater Support: ${Bun.env.GOR_SUPPORT_ENABLED === "true" ? "aktiv" : "noch nicht freigeschaltet"}\nFunktionen: Support, Projektanfragen, Rollenwahl und Ankündigungen mit Vorschau.\nSicherungen: ${store.backupHealthy ? "letzter lokaler Lauf erfolgreich" : "Leitung muss den Sicherungslauf prüfen"}`); break;
      case "unterstuetzen": await answer(i, `GoR wird freiwillig unterstützt. Informationen: <#${CHANNELS["gor-unterstuetzen"]}>\nKosten und Stand: <#${CHANNELS["kosten-und-stand"]}>\nhttps://gor-shop.de\nDu kannst auch ohne Zahlung vollständig zur Community gehören. Für Zahlungsfragen nutze /support.`); break;
      case "rollen": {
        const select = new StringSelectMenuBuilder().setCustomId("gor:roles:v4").setPlaceholder("Deine Auswahl · leer = keine dieser Rollen")
          .setMinValues(0).setMaxValues(Object.keys(SELF_ROLES).length).addOptions(Object.entries(SELF_ROLES).map(([value, label]) => ({ value, label, default: member.roles.cache.has(ROLES[value]) })));
        await answer(i, "Wähle die Spiele und Themen, die dich interessieren. Deine übrigen Rollen bleiben erhalten.", { components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)] }); break;
      }
      case "faelle": {
        if (!Object.keys(KINDS).some(k => eligible(k, member.id, [...member.roles.cache.keys()], guild.ownerId))) throw new UserError("Für die Fallübersicht fehlt die Zuständigkeit.");
        const rows = store.queue().filter(c => canHandle(c, member));
        await answer(i, rows.length ? rows.slice(0, 20).map(c => `**${c.id}** · ${KINDS[c.kind].title} · ${c.status} · ${c.assignee_id ? "zugewiesen" : "unzugewiesen"}`).join("\n") + (rows.length > 20 ? `\nWeitere ${rows.length - 20} Fälle vorhanden.` : "") : "Keine für dich zuständigen offenen Fälle."); break;
      }
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
        if (c.status !== "open") throw new UserError("Dieser Fall ist nicht offen oder muss geprüft werden.");
        const ch = await caseChannel(guild, c); store.change(c.id, { status: "closing" });
        try {
          for (const id of new Set([c.opener_id, c.assignee_id].filter(Boolean) as string[]))
            await ch.permissionOverwrites.edit(id, { ViewChannel: true, SendMessages: false, ReadMessageHistory: true }, { type: OverwriteType.Member, reason: "GoR Fallabschluss" });
          const confirmed = await caseChannel(guild, c);
          for (const id of [c.opener_id, c.assignee_id].filter(Boolean) as string[])
            if (!confirmed.permissionOverwrites.cache.get(id)?.deny.has(P.SendMessages)) throw new UserError("Der Schreibschutz ist noch nicht bestätigt.");
          await ch.send({ content: "**Abgeschlossen.** Der Verlauf bleibt für die bisherigen Beteiligten lesbar. Die Leitung prüft die weitere Aufbewahrung.", allowedMentions: MENTIONS });
          store.change(c.id, { status: "closed" }); store.audit(member.id, "case_close", String(c.id));
        } catch (e) { store.change(c.id, { status: "needs_review" }); throw e; }
        await answer(i, "Der Fall ist abgeschlossen und für die Beteiligten schreibgeschützt.");
      }); break;
      case "fall_zuordnen": await serial(async () => {
        own(member); const c = store.get(i.options.getInteger("fall", true));
        if (!["creating", "assigning", "closing", "needs_review"].includes(c.status)) throw new UserError("Dieser Fall benötigt keine Wiederaufnahme.");
        const ch = await textChannel(guild, i.options.getChannel("kanal", true).id); checkPrivacy(ch, c);
        try {
          for (const id of new Set([c.opener_id, c.assignee_id].filter(Boolean) as string[]))
            await ch.permissionOverwrites.edit(id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }, { type: OverwriteType.Member, reason: "GoR bestätigte Wiederaufnahme" });
          const saved = store.change(c.id, { channel_id: ch.id, status: "open" }); await caseChannel(guild, saved);
        } catch (e) { store.change(c.id, { status: "needs_review" }); throw e; }
        store.audit(member.id, "case_recover", String(c.id)); await answer(i, `Bestehenden Kanal bestätigt: <#${ch.id}>.`);
      }); break;
      case "supportpanel": await serial(async () => {
        own(member); const ch = await textChannel(guild, CHANNELS.support), saved = store.setting("panel_message_id");
        if (saved === "pending") throw new UserError("Die letzte Anlage ist unklar. Bitte die vorhandene Nachricht mit /panel_zuordnen bestätigen.");
        let message;
        if (saved) {
          message = await ch.messages.fetch(saved); if (message.author.id !== APPLICATION) throw new UserError("Das gespeicherte Bedienfeld gehört nicht zum Bot.");
          await message.edit({ content: panelBody, components: panel(), allowedMentions: MENTIONS });
        } else {
          store.setting("panel_message_id", "pending"); message = await ch.send({ content: panelBody, components: panel(), allowedMentions: MENTIONS });
          store.setting("panel_message_id", message.id);
        }
        const check = await ch.messages.fetch({ message: message.id, force: true });
        if (check.content !== panelBody) throw new UserError("Der Bedienfeldinhalt ist noch nicht bestätigt.");
        store.audit(member.id, "panel_publish", message.id); await answer(i, `Supportbedienfeld: ${message.url}`);
      }); break;
      case "panel_zuordnen": await serial(async () => {
        own(member); const id = i.options.getString("nachricht", true);
        if (!/^\d{15,22}$/.test(id)) throw new UserError("Bitte die konkrete Nachrichten-ID verwenden.");
        const ch = await textChannel(guild, CHANNELS.support), m = await ch.messages.fetch(id);
        const ids = m.components.flatMap(row => "components" in row ? row.components.map((c: any) => c.customId) : []).sort();
        if (m.author.id !== APPLICATION || JSON.stringify(ids) !== JSON.stringify(["gor:projekt:v3", "gor:support:v3"])) throw new UserError("Das ist kein passendes GoR Supportbedienfeld.");
        store.setting("panel_message_id", id); store.audit(member.id, "panel_recover", id); await answer(i, "Das vorhandene Supportbedienfeld ist bestätigt.");
      }); break;
      case "serverpruefen": {
        leadership(member); const roles = await guild.roles.fetch(), channels = await guild.channels.fetch(), me = await guild.members.fetchMe({ force: true });
        const missingRoles = Object.keys(ROLES).filter(k => !roles.has(ROLES[k])), missingChannels = Object.keys(CHANNELS).filter(k => !channels.has(CHANNELS[k]));
        const checks = ["**GoR · Serverprüfung**", `Rollen: ${16 - missingRoles.length}/16 · Kanäle: ${41 - missingChannels.length}/41`,
          `Community: ${guild.features.includes("COMMUNITY") ? "von Discord bestätigt" : "noch nicht aktiviert"}`,
          `Regelprüfung: ${guild.features.includes("MEMBER_VERIFICATION_GATE_ENABLED") ? "von Discord bestätigt" : "nicht bestätigt"}`,
          `Onboarding: ${(guild.features as string[]).includes("GUILD_ONBOARDING_EVER_ENABLED") ? "wurde eingerichtet; aktuellen Ablauf manuell prüfen" : "nicht bestätigt"}`,
          `Bot: ${[P.ManageChannels, P.ManageRoles, P.ViewChannel, P.SendMessages, P.ReadMessageHistory].every(p => me.permissions.has(p)) ? "Grundrechte vorhanden" : "einzelne Grundrechte fehlen"}`,
          `Offene oder zu prüfende Fälle: ${store.queue().length}`, `Sicherungen: ${store.backupHealthy ? "lokal verfügbar" : "prüfen"}`];
        if (missingRoles.length) checks.push("Fehlende Rollen: " + missingRoles.join(", "));
        if (missingChannels.length) checks.push("Fehlende Kanäle: " + missingChannels.join(", "));
        checks.push("AutoMod, Kanalüberschreibungen und Rollenrangfolge werden durch diese Übersicht nicht als fehlerfrei bestätigt.");
        await answer(i, checks.join("\n")); break;
      }
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
      if (i.isRepliable()) try {
        await answer(i, e instanceof UserError ? e.message : "Der Vorgang konnte nicht bestätigt werden. Bitte die Networkleitung informieren. Unklare Änderungen werden nicht auf Verdacht wiederholt.");
      } catch { safeLog("interaction_response_failed"); }
    }).finally(() => { try { store.backup(); store.cleanup(); } catch { safeLog("maintenance_failed"); } });
  });
  client.on(Events.ClientReady, () => {
    void serial(async () => {
      ready = false; state = "checking";
      await client.application!.fetch();
      const guild = await client.guilds.fetch(GUILD); await assertBot(guild);
      const current = await guild.commands.fetch();
      for (const definition of commandDefinitions()) {
        const existing = current.find(c => c.name === definition.name && c.type === 1);
        const desired = commandShape(definition);
        if (!existing) await guild.commands.create(definition);
        else if (commandShape(existing.toJSON()) !== desired) await guild.commands.edit(existing.id, definition);
      }
      // Preserve all other application commands; a bulk overwrite would silently delete them.
      const confirmed = await guild.commands.fetch();
      if (commandDefinitions().some(d => !confirmed.some(c => c.type === 1 && commandShape(c.toJSON()) === commandShape(d)))) throw new UserError("Die Befehlsregistrierung ist noch nicht bestätigt.");
      store.backup(); ready = true; state = "ready"; lastHealthy = Date.now();
      client.user!.setPresence({ activities: [{ name: "/hilfe · GoR Network", type: ActivityType.Watching }], status: "online" });
      safeLog("discord_ready");
    }).catch(() => { safeLog("startup_check_failed"); void shutdown(1); });
  });
  const token = Bun.env.GOR_DISCORD_BOT_TOKEN;
  if (!token) { state = "token_missing"; safeLog("configuration_token_missing"); return; }
  maintenance = setTimeout(maintain, 60_000); maintenance.unref();
  // Never log the token or a Discord HTTP request/response body.
  try { await client.login(token); } catch { safeLog("discord_login_failed"); await shutdown(1); }
}

if (import.meta.main) {
  try { await main(); } catch (e) { safeLog("service_start_failed"); process.exitCode = 1; }
}

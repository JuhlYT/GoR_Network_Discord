import { ChannelType, PermissionFlagsBits as P, OverwriteType, type Guild } from "discord.js";
import type { Database } from "bun:sqlite";
import { LAYOUT, LEGACY_MESSAGE_IDS, type Layout, type Profile } from "./server_blueprint";
import { SetupJournal } from "./setup_journal";
import { BASIC, MOD, PRIVATE_PROFILES, compatibleType, overwriteShape, profileOverwrites } from "./setup_permissions";
import { MESSAGE_KEYS, setupMessage } from "./server_content";
import { sameCommunityPanel } from "./community_ui";
import { reconcileNative } from "./setup_native";
import { protectedField } from "./change_plan";
import type { LegalLinks } from "./legal_config";

export type SetupMaps = { roles: Record<string, string>; categories: Record<string, string>; channels: Record<string, string> };
export type SetupStorage = { db: Database; setting(key: string, value?: string): string | undefined };
export type SetupContext = { guild: Guild; application: string; target: string; maps: SetupMaps; storage: SetupStorage; stopped?: () => boolean; layout?: Layout; legal?: LegalLinks };
export type SetupReport = { at: number; created: number; updated: number; unchanged: number; adopted: number; issues: { key: string; code: string }[]; status: string };
export const SETUP_ISSUES: Record<string, string> = {
  missing_permissions: "Dem Bot fehlen Rechte für diesen Bereich.", role_uneditable: "Die Rolle liegt über der Botrolle oder wird von Discord verwaltet.",
  creation_unknown: "Eine frühere Anlage ist unklar. Vorhandenen Eintrag zuordnen; nicht erneut anlegen.",
  name_conflict: "Ein nicht zugeordneter Eintrag mit diesem Namen existiert bereits.", duplicate_marker: "Eine Anlagekennung ist mehrfach vorhanden.",
  resource_type: "Der gespeicherte Eintrag hat einen anderen Kanaltyp.", not_owned: "Die Nachricht oder Regel gehört nicht zur GoR-Anwendung.",
  dependency_missing: "Eine benötigte Rolle oder ein übergeordneter Bereich fehlt.", verification_failed: "Discord bestätigt die Änderung noch nicht vollständig.",
  role_safety: "Rechte, Rangfolge oder interne Zugriffe einer Auswahlrolle müssen geprüft werden.", native_unavailable: "Eine native Discord-Funktion ist noch nicht verfügbar.",
  external_automod: "Eine vorhandene fremde Erwähnungsschutzregel ist deaktiviert. Sie wird nicht überschrieben.",
  lease_busy: "Ein anderer Einrichtungslauf ist noch aktiv.", lease_lost: "Die Einrichtungssperre wurde übernommen; dieser Lauf wurde angehalten.",
  cancelled: "Der Bot wird gerade beendet.", invalid_resource: "Dieser Eintrag gehört nicht zur GoR-Konfiguration.",
  invalid_profile: "Das konfigurierte Rechteprofil ist ungültig.", api_unavailable: "Discord ist vorübergehend nicht erreichbar.",
  unexpected_error: "Dieser Einrichtungsschritt muss anhand seines festen Schlüssels geprüft werden.",
};
export function setupError(code: string): Error { return Object.assign(new Error(code), { setupCode: code }); }
export function issueCode(error: any) {
  if (Object.hasOwn(SETUP_ISSUES, error?.setupCode)) return error.setupCode as string;
  if (error?.code === 50013 || error?.code === 50001 || error?.status === 403) return "missing_permissions";
  if (error?.status >= 500 || ["ETIMEDOUT", "ECONNRESET", "ENOTFOUND"].includes(error?.code ?? error?.cause?.code)) return "api_unavailable";
  return "unexpected_error";
}
export function resourceKnown(key: string, layout = LAYOUT) {
  return layout.roles.some(r => key === "role:" + r.key) || layout.categories.some(c => key === "category:" + c.key
    || c.channels.some(ch => key === "channel:" + ch.key)) || MESSAGE_KEYS.some(k => key === "message:" + k) || key === "automod:mentions";
}
export function hydrateManagedMaps(storage: SetupStorage, maps: SetupMaps) {
  const journal = new SetupJournal(storage.db);
  for (const [kind, mapping] of [["role", maps.roles], ["category", maps.categories], ["channel", maps.channels]] as const)
    for (const key of Object.keys(mapping)) {
      const record = journal.get(kind + ":" + key);
      if (record?.id && /^\d{15,22}$/.test(record.id)) mapping[key] = record.id;
    }
}
export class AutoSetup {
  readonly journal: SetupJournal;
  readonly layout: Layout;
  readonly owner = crypto.randomUUID();
  readonly report: SetupReport = { at: Date.now(), created: 0, updated: 0, unchanged: 0, adopted: 0, issues: [], status: "running" };
  roles = new Map<string, any>();
  channels = new Map<string, any>();
  highest: any = null;
  constructor(readonly ctx: SetupContext) { this.journal = new SetupJournal(ctx.storage.db); this.layout = ctx.layout || LAYOUT; }
  protected(key: string,field: string) { return protectedField(this.ctx.storage,key,field); }
  check() {
    if (this.ctx.stopped?.()) throw setupError("cancelled");
    if (!this.journal.renew(this.owner)) throw setupError("lease_lost");
  }
  async step(key: string, action: () => Promise<void>) {
    this.check();
    try { await action(); }
    catch (error: any) {
      const code = issueCode(error); this.report.issues.push({ key, code });
      this.journal.fail(key, code, error?.status >= 400 && error?.status < 500 && error?.status !== 408);
    }
  }
  async obtain(key: string, initial: string | undefined, name: string, entries: Map<string, any>, create: (marker: string) => Promise<any>) {
    const record = this.journal.get(key), id = record?.id || initial;
    if (id && entries.has(id)) {
      if (record?.id !== id || record.state !== "active") { this.journal.bind(key, id); this.report.adopted++; }
      return entries.get(id);
    }
    if (record?.state === "creating" || record?.state === "review") {
      const matches = [...entries.values()].filter(value => value.name === record.marker);
      if (matches.length !== 1) throw setupError(matches.length ? "duplicate_marker" : "creation_unknown");
      this.journal.bind(key, matches[0].id); this.report.adopted++; return matches[0];
    }
    if ([...entries.values()].some(value => value.name === name)) throw setupError("name_conflict");
    const pending = this.journal.begin(key);
    if (!pending.fresh) throw setupError("creation_unknown");
    this.check();
    const created = await create(pending.record.marker!);
    this.journal.bind(key, created.id); entries.set(created.id, created); this.report.created++; return created;
  }
  async role(spec: Layout["roles"][number]) {
    const key = "role:" + spec.key, me = await this.ctx.guild.members.fetchMe();
    const target = await this.obtain(key, this.ctx.maps.roles[spec.key], spec.name, this.roles, marker => this.ctx.guild.roles.create({
      name: marker, permissions: 0n, mentionable: false, reason: "GoR automatische Rollenanlage",
    }));
    if (target.managed) throw setupError("role_uneditable");
    this.ctx.maps.roles[spec.key] = target.id;
    const patch: Record<string, any> = {};
    if (target.name !== spec.name && !this.protected(key,"name")) patch.name = spec.name;
    if (target.color !== spec.color && !this.protected(key,"color")) patch.color = spec.color;
    if (target.hoist !== spec.hoist && !this.protected(key,"hoist")) patch.hoist = spec.hoist;
    if (target.mentionable) patch.mentionable = false;
    if (spec.selfAssignable && target.permissions.bitfield !== 0n) patch.permissions = 0n;
    if (["networkleitung", "communityleitung", "moderation"].includes(spec.key) && (target.permissions.bitfield & MOD) !== MOD)
      patch.permissions = target.permissions.bitfield | MOD;
    if (!Object.keys(patch).length) { this.report.unchanged++; return; }
    if (target.comparePositionTo(me.roles.highest) >= 0) throw setupError("role_uneditable");
    this.journal.snapshot(key, { id: target.id, name: target.name, color: target.color, hoist: target.hoist, mentionable: target.mentionable, permissions: String(target.permissions.bitfield) });
    await this.ctx.guild.roles.edit(target.id, { ...patch, reason: "GoR einheitliche Rollengestaltung" });
    const actual = await this.ctx.guild.roles.fetch(target.id, { force: true });
    if (!actual || Object.entries(patch).some(([field, value]) => field === "permissions" ? actual.permissions.bitfield !== value : (actual as any)[field] !== value)) throw setupError("verification_failed");
    this.roles.set(actual.id, actual); this.report.updated++;
  }
  desiredPermissions(profile: Profile) {
    return profileOverwrites(profile, this.ctx.target, this.ctx.application, this.ctx.maps.roles, new Set(this.roles.keys()));
  }
  async channel(spec: { key: string; name: string; profile: Profile; type?: "text" | "voice"; topic?: string; slowmode?: number }, parent?: string) {
    const category = !spec.type, key = (category ? "category:" : "channel:") + spec.key;
    const mapping = category ? this.ctx.maps.categories : this.ctx.maps.channels;
    const type = category ? "category" : spec.type!;
    if (!category && (!parent || !this.channels.has(parent))) throw setupError("dependency_missing");
    const permissions = this.desiredPermissions(spec.profile);
    const target = await this.obtain(key, mapping[spec.key], spec.name, this.channels, marker => this.ctx.guild.channels.create({
      name: marker, type: category ? ChannelType.GuildCategory : type === "voice" ? ChannelType.GuildVoice : ChannelType.GuildText,
      ...(parent ? { parent } : {}), reason: "GoR automatische Bereichsanlage",
      permissionOverwrites: [{ id: this.ctx.target, type: OverwriteType.Role, deny: P.ViewChannel },
        { id: this.ctx.application, type: OverwriteType.Member, allow: BASIC | P.CreatePrivateThreads }],
    }));
    if (!compatibleType(target.type, type)) throw setupError("resource_type");
    if (target.topic?.startsWith("gor-case:")) throw setupError("resource_type");
    mapping[spec.key] = target.id;
    const patch: Record<string, any> = {};
    if (target.name !== spec.name && !this.protected(key,"name")) patch.name = spec.name;
    if (!category && target.parentId !== parent) patch.parent = parent;
    if (type === "text" && target.topic !== spec.topic && !this.protected(key,"topic")) patch.topic = spec.topic;
    if (type === "text" && target.rateLimitPerUser !== spec.slowmode && !this.protected(key,"rateLimitPerUser")) patch.rateLimitPerUser = spec.slowmode;
    if (overwriteShape(target.permissionOverwrites.cache.values()) !== overwriteShape(permissions)) patch.permissionOverwrites = permissions;
    if (!Object.keys(patch).length) { this.report.unchanged++; return; }
    this.journal.snapshot(key, { id: target.id, name: target.name, parentId: target.parentId, topic: target.topic, slowmode: target.rateLimitPerUser,
      overwrites: [...target.permissionOverwrites.cache.values()].map((o: any) => ({ id: o.id, type: o.type, allow: String(o.allow.bitfield), deny: String(o.deny.bitfield) })) });
    await this.ctx.guild.channels.edit(target.id, { ...patch, reason: "GoR Gestaltung und Bereichsrechte" });
    const actual: any = await this.ctx.guild.channels.fetch(target.id, { force: true });
    if (!actual || (!this.protected(key,"name") && actual.name !== spec.name) || (!category && actual.parentId !== parent)
        || (type === "text" && ((!this.protected(key,"topic") && actual.topic !== spec.topic) || (!this.protected(key,"rateLimitPerUser") && actual.rateLimitPerUser !== spec.slowmode)))
        || overwriteShape(actual.permissionOverwrites.cache.values()) !== overwriteShape(permissions)) throw setupError("verification_failed");
    this.channels.set(actual.id, actual); this.report.updated++;
  }
  privacyReady() {
    try {
      for (const role of this.layout.roles.filter(r => r.selfAssignable)) {
        const actual = this.roles.get(this.ctx.maps.roles[role.key]);
        if (!actual || actual.managed || actual.permissions.bitfield !== 0n || !this.highest || actual.comparePositionTo(this.highest) >= 0) return false;
      }
      const publicParents = new Set(this.layout.categories.filter(c => !PRIVATE_PROFILES.has(c.profile)).map(c => this.ctx.maps.categories[c.key]));
      const harmless = BASIC;
      const selected = new Set(this.layout.roles.filter(r => r.selfAssignable).map(r => this.ctx.maps.roles[r.key]));
      for (const ch of this.channels.values()) if (ch.permissionOverwrites) for (const o of ch.permissionOverwrites.cache.values()) {
        if (!selected.has(o.id)) continue;
        const publicArea = publicParents.has(ch.type === ChannelType.GuildCategory ? ch.id : ch.parentId);
        if ((o.allow.bitfield & ~harmless) || ((o.allow.bitfield & P.ViewChannel) && !publicArea)) return false;
      }
      for (const category of this.layout.categories) for (const spec of [category, ...category.channels]) {
        if (!PRIVATE_PROFILES.has(spec.profile)) continue;
        const ch = this.channels.get((spec === category ? this.ctx.maps.categories : this.ctx.maps.channels)[spec.key]);
        if (!ch || overwriteShape(ch.permissionOverwrites.cache.values()) !== overwriteShape(this.desiredPermissions(spec.profile))) return false;
      }
      return true;
    } catch { return false; }
  }
  async message(key: string) {
    const channel: any = this.channels.get(this.ctx.maps.channels[key]);
    if (!channel || !compatibleType(channel.type, "text")) throw setupError("dependency_missing");
    const resource = "message:" + key, payload = setupMessage(key, this.ctx.maps.channels,this.ctx.legal);
    const setting = key === "start" ? "community_panel_message_id" : key === "support" ? "panel_message_id" : undefined;
    const saved = this.journal.get(resource), previous = setting ? this.ctx.storage.setting(setting) : undefined;
    const id = saved?.id || (previous === "pending" ? undefined : previous || LEGACY_MESSAGE_IDS[key]);
    let target: any;
    if (id) try { target = await channel.messages.fetch({ message: id, force: true }); }
    catch (error: any) { if (error?.code !== 10008 && error?.status !== 404) throw error; }
    if (!target) {
      const recent = await channel.messages.fetch({ limit: 100 });
      const matches = [...recent.values()].filter(m => sameCommunityPanel(m, payload, this.ctx.application));
      if (matches.length > 1) throw setupError("name_conflict");
      if (matches.length === 1) { target = matches[0]; this.report.adopted++; }
      else {
        if (saved?.state === "creating" || saved?.state === "review" || previous === "pending") throw setupError("creation_unknown");
        const pending = this.journal.begin(resource);
        if (!pending.fresh) throw setupError("creation_unknown");
        target = await channel.send({ ...payload, allowedMentions: { parse: [] }, nonce: pending.record.marker!.slice(-24), enforceNonce: true });
        this.report.created++;
      }
    }
    if (target.author.id !== this.ctx.application) throw setupError("not_owned");
    this.journal.bind(resource, target.id); if (setting) this.ctx.storage.setting(setting, target.id);
    if (!sameCommunityPanel(target, payload, this.ctx.application)) {
      this.journal.snapshot(resource, { id: target.id, content: target.content,
        embeds: target.embeds.map((e: any) => typeof e.toJSON === "function" ? e.toJSON() : e) });
      await target.edit({ ...payload, attachments: [], allowedMentions: { parse: [] } }); this.report.updated++;
    } else this.report.unchanged++;
    const actual = await channel.messages.fetch({ message: target.id, force: true });
    if (!sameCommunityPanel(actual, payload, this.ctx.application)) throw setupError("verification_failed");
  }
  async positions() {
    const groups = [this.layout.categories.map(c => this.ctx.maps.categories[c.key]),
      ...this.layout.categories.flatMap(c => ["text", "voice"].map(type => c.channels.filter(ch => ch.type === type).map(ch => this.ctx.maps.channels[ch.key])))];
    for (const ids of groups) {
      const entries = ids.map(id => this.channels.get(id)); if (entries.some(ch => !ch)) continue;
      const slots = entries.map(ch => ch.rawPosition).sort((a, b) => a - b);
      const changes = entries.map((ch, i) => ({ channel: ch.id, position: slots[i] })).filter((item, i) => item.position !== entries[i].rawPosition);
      if (changes.length) {
        await this.ctx.guild.channels.setPositions(changes);
        const actual = await this.ctx.guild.channels.fetch();
        if (changes.some(c => (actual.get(c.channel) as any)?.rawPosition !== c.position)) throw setupError("verification_failed");
        for (const [id, ch] of actual) if (ch) this.channels.set(id, ch);
        this.report.updated++;
      }
    }
    const me = await this.ctx.guild.members.fetchMe();
    const entries = this.layout.roles.map(r => this.roles.get(this.ctx.maps.roles[r.key])).filter(r => r && !r.managed && r.comparePositionTo(me.roles.highest) < 0);
    const slots = entries.map(r => r.position).sort((a, b) => b - a);
    const changes = entries.map((role, i) => ({ role: role.id, position: slots[i] })).filter((item, i) => item.position !== entries[i].position);
    if (changes.length) {
      await this.ctx.guild.roles.setPositions(changes); const actual = await this.ctx.guild.roles.fetch();
      if (changes.some(c => actual.get(c.role)?.position !== c.position)) throw setupError("verification_failed");
      for (const [id, role] of actual) this.roles.set(id, role);
      this.report.updated++;
    }
  }
  async run() {
    if (this.ctx.guild.id !== this.ctx.target || this.ctx.guild.client.user?.id !== this.ctx.application) throw setupError("not_owned");
    if (!this.journal.acquire(this.owner)) { this.report.status = "waiting"; this.report.issues.push({ key: "setup", code: "lease_busy" }); return this.report; }
    try {
      this.roles = new Map((await this.ctx.guild.roles.fetch()).entries());
      this.highest = (await this.ctx.guild.members.fetchMe()).roles.highest;
      this.channels = new Map([...((await this.ctx.guild.channels.fetch()).entries())].filter(([, ch]) => ch));
      await this.step("onboarding:pause", async () => {
        if (!this.privacyReady()) { const current = await this.ctx.guild.fetchOnboarding(); if (current.enabled) { await this.ctx.guild.editOnboarding({ enabled: false, reason: "GoR Einrichtung: Rollen und interne Zugriffe zuerst prüfen" }); this.report.updated++; } }
      });
      for (const spec of this.layout.roles) await this.step("role:" + spec.key, () => this.role(spec));
      for (const category of this.layout.categories) {
        await this.step("category:" + category.key, () => this.channel(category));
        for (const spec of category.channels) await this.step("channel:" + spec.key, () => this.channel(spec, this.ctx.maps.categories[category.key]));
      }
      await this.step("positions", () => this.positions());
      for (const key of MESSAGE_KEYS) if (this.layout.categories.some(c => c.channels.some(ch => ch.key === key))) await this.step("message:" + key, () => this.message(key));
      await reconcileNative(this);
      this.report.status = this.report.issues.length ? "attention" : "ready";
    } catch (error) { this.report.status = "attention"; this.report.issues.push({ key: "setup", code: issueCode(error) }); }
    finally { this.journal.release(this.owner); }
    this.ctx.storage.setting("auto_setup_report", JSON.stringify(this.report));
    return this.report;
  }
}
export async function reconcileServer(context: SetupContext) { return new AutoSetup(context).run(); }
export async function adoptSetupResource(context: SetupContext, key: string, id: string) {
  const layout = context.layout || LAYOUT, journal = new SetupJournal(context.storage.db);
  if (!resourceKnown(key, layout) || !/^\d{15,22}$/.test(id)) throw setupError("invalid_resource");
  if (context.guild.id !== context.target || context.guild.client.user?.id !== context.application) throw setupError("not_owned");
  const owner = crypto.randomUUID(); if (!journal.acquire(owner)) throw setupError("lease_busy");
  try {
  const [kind, name] = key.split(":");
  if (kind === "role") {
    const role = await context.guild.roles.fetch(id, { force: true });
    if (!role || role.managed || role.id === context.target) throw setupError("resource_type");
    if (role.name !== layout.roles.find(r => r.key === name)!.name && role.name !== journal.get(key)?.marker) throw setupError("name_conflict");
    context.maps.roles[name] = id;
  } else if (kind === "category" || kind === "channel") {
    const actual: any = await context.guild.channels.fetch(id, { force: true });
    const type = kind === "category" ? "category" : layout.categories.flatMap(c => c.channels).find(c => c.key === name)!.type;
    if (!actual || !compatibleType(actual.type, type) || actual.topic?.startsWith("gor-case:")) throw setupError("resource_type");
    (kind === "category" ? context.maps.categories : context.maps.channels)[name] = id;
  } else if (kind === "message") {
    const channel: any = await context.guild.channels.fetch(context.maps.channels[name], { force: true });
    const message = await channel.messages.fetch({ message: id, force: true });
    if (!sameCommunityPanel(message, setupMessage(name, context.maps.channels), context.application)) throw setupError("not_owned");
    if (name === "start") context.storage.setting("community_panel_message_id", id);
    if (name === "support") context.storage.setting("panel_message_id", id);
  } else {
    const rule = await context.guild.autoModerationRules.fetch(id);
    if (!rule || rule.creatorId !== context.application || rule.triggerType !== 5) throw setupError("not_owned");
  }
  journal.bind(key, id);
  } finally { journal.release(owner); }
}

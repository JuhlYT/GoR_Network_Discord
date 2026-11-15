/** In-memory Discord adapter for reconciliation regressions. No network or credential. */
import { Collection, PermissionFlagsBits as P, PermissionsBitField, ChannelType } from "discord.js";
import { APPLICATION, GUILD, ROLES, CATEGORIES, CHANNELS } from "../../gor_network";
import type { SetupMaps } from "../../auto_setup";

export class LayoutFixture {
  id = GUILD;
  client: any = { user: { id: APPLICATION }, guilds: { cache: new Collection() } };
  name = "Alter GoR-Name"; description: string | null = null; features: string[] = [];
  afkChannelId: string | null = null; afkTimeout = 60; systemChannelId: string | null = null;
  rulesChannelId: string | null = null; publicUpdatesChannelId: string | null = null;
  defaultMessageNotifications = 0; verificationLevel = 0; explicitContentFilter = 0; preferredLocale = "en-US";
  roleRows = new Collection<string, any>(); channelRows = new Collection<string, any>(); ruleRows = new Collection<string, any>();
  calls: { action: string; id?: string; payload?: any }[] = [];
  denied = new Set<string>(); lostRole: "before" | "after" | null = null;
  native: any = { enabled: false, mode: 0, prompts: [], defaultChannels: [] };
  counter = 1900000000000000000n;
  next() { return String(++this.counter); }
  me: any;
  constructor() {
    const highest = this.makeRole("1999999999999999998", "GoR Bot", { position: 10000, managed: true });
    this.makeRole(GUILD, "@everyone", { position: 0 });
    this.me = { id: APPLICATION, nickname: null, permissions: new PermissionsBitField(P.Administrator), roles: { highest },
      setNickname: async (value: string) => { this.calls.push({ action: "nickname" }); this.me.nickname = value; return this.me; } };
    this.client.guilds.cache.set(GUILD, this);
  }
  maps(): SetupMaps { return { roles: { ...ROLES }, categories: { ...CATEGORIES }, channels: { ...CHANNELS } }; }
  makeRole(id = this.next(), name = "Extra", fields: any = {}) {
    const role: any = { id, name, color: 0, hoist: false, mentionable: false, managed: false, position: this.roleRows.size,
      permissions: new PermissionsBitField(0n), ...fields };
    if (typeof role.permissions === "bigint") role.permissions = new PermissionsBitField(role.permissions);
    role.comparePositionTo = (other: any) => role.position - other.position;
    this.roleRows.set(id, role); return role;
  }
  roles: any = {
    cache: this.roleRows,
    fetch: async (id?: string) => id ? this.roleRows.get(id) || null : this.roleRows,
    create: async (payload: any) => {
      this.calls.push({ action: "role.create", payload }); const lost = this.lostRole; this.lostRole = null;
      if (lost === "before") throw Object.assign(new Error("private-fixture-error"), { code: "ECONNRESET" });
      const role = this.makeRole(this.next(), payload.name, { permissions: payload.permissions || 0n });
      if (lost === "after") throw Object.assign(new Error("private-fixture-error"), { code: "ECONNRESET" });
      return role;
    },
    edit: async (id: string, payload: any) => {
      if (this.denied.has("role.edit:" + id)) throw Object.assign(new Error("private-fixture-error"), { code: 50013, status: 403 });
      this.calls.push({ action: "role.edit", id, payload }); const role = this.roleRows.get(id);
      for (const key of ["name", "color", "hoist", "mentionable"]) if (key in payload) role[key] = payload[key];
      if ("permissions" in payload) role.permissions = new PermissionsBitField(payload.permissions);
      return role;
    },
    setPositions: async (changes: any[]) => { this.calls.push({ action: "role.positions", payload: changes }); for (const c of changes) this.roleRows.get(c.role).position = c.position; return this.roleRows; },
  };
  overwrite(values: any[]) {
    return new Collection(values.map(o => [o.id, { id: o.id, type: o.type, allow: new PermissionsBitField(o.allow || 0n), deny: new PermissionsBitField(o.deny || 0n) }]));
  }
  makeChannel(id = this.next(), name = "extra", fields: any = {}) {
    const rows = new Collection<string, any>();
    const channel: any = { id, name, guild: this, type: ChannelType.GuildText, parentId: null, topic: null, rateLimitPerUser: 0,
      rawPosition: this.channelRows.size, permissionOverwrites: { cache: this.overwrite([]) }, ...fields };
    channel.rows = rows;
    channel.messages = { fetch: async (options: any) => {
      if (options.limit) return new Collection([...rows.entries()].slice(-options.limit));
      const result = rows.get(typeof options === "string" ? options : options.message);
      if (!result) throw Object.assign(new Error("Missing fixture message"), { code: 10008, status: 404 });
      return result;
    } };
    channel.send = async (payload: any) => {
      this.calls.push({ action: "message.create", id, payload });
      const message: any = { id: this.next(), author: { id: APPLICATION }, content: payload.content || "", embeds: payload.embeds || [], components: payload.components || [] };
      message.edit = async (updated: any) => { this.calls.push({ action: "message.edit", id: message.id }); Object.assign(message, updated); return message; };
      rows.set(message.id, message); return message;
    };
    this.channelRows.set(id, channel); return channel;
  }
  channels: any = {
    cache: this.channelRows,
    fetch: async (id?: string) => {
      if (!id) return this.channelRows;
      const channel = this.channelRows.get(id); if (!channel) throw Object.assign(new Error("Missing fixture channel"), { code: 10003, status: 404 }); return channel;
    },
    create: async (payload: any) => {
      this.calls.push({ action: "channel.create", payload });
      return this.makeChannel(this.next(), payload.name, { type: payload.type, parentId: payload.parent || null,
        permissionOverwrites: { cache: this.overwrite(payload.permissionOverwrites || []) } });
    },
    edit: async (id: string, payload: any) => {
      if (this.denied.has("channel.edit:" + id)) throw Object.assign(new Error("private-fixture-error"), { code: 50013, status: 403 });
      this.calls.push({ action: "channel.edit", id, payload }); const channel = this.channelRows.get(id);
      for (const key of ["name", "topic", "rateLimitPerUser"]) if (key in payload) channel[key] = payload[key];
      if ("parent" in payload) channel.parentId = payload.parent;
      if (payload.permissionOverwrites) channel.permissionOverwrites.cache = this.overwrite(payload.permissionOverwrites);
      return channel;
    },
    setPositions: async (changes: any[]) => { this.calls.push({ action: "channel.positions", payload: changes }); for (const c of changes) this.channelRows.get(c.channel).rawPosition = c.position; return this.channelRows; },
  };
  members: any = { fetchMe: async () => this.me };
  async edit(patch: any) {
    this.calls.push({ action: "guild.edit", payload: patch });
    const names: Record<string, string> = { afkChannel: "afkChannelId", systemChannel: "systemChannelId", rulesChannel: "rulesChannelId", publicUpdatesChannel: "publicUpdatesChannelId" };
    for (const [key, value] of Object.entries(patch)) if (key !== "reason") (this as any)[names[key] || key] = value;
    return this;
  }
  async fetch() { return this; }
  async fetchOnboarding() { return this.native; }
  async editOnboarding(patch: any) {
    this.calls.push({ action: "onboarding.edit", payload: patch });
    this.native = { ...this.native, ...patch };
    if (patch.prompts) this.native.prompts = patch.prompts.map((p: any) => ({ ...p, id: p.id || this.next(),
      options: p.options.map((o: any) => ({ ...o, id: o.id || this.next() })) }));
    return this.native;
  }
  autoModerationRules: any = {
    fetch: async (id?: any) => id ? this.ruleRows.get(typeof id === "string" ? id : id.autoModerationRule) : this.ruleRows,
    create: async (payload: any) => { this.calls.push({ action: "automod.create", payload }); const rule = { ...payload, id: this.next(), creatorId: APPLICATION }; this.ruleRows.set(rule.id, rule); return rule; },
    edit: async (id: string, patch: any) => { this.calls.push({ action: "automod.edit", id, payload: patch }); const rule = this.ruleRows.get(id); Object.assign(rule, patch); return rule; },
  };
}

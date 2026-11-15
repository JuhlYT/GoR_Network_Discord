import { Routes, type REST } from "discord.js";

export type CommandPhase = "pending" | "application" | "guild" | "publish" | "verify" | "registered";
type Definition = { name: string; description: string; options?: any[]; [key: string]: any };
type Transport = Pick<REST, "get" | "post" | "patch">;
export class CommandRegistrationError extends Error {
  constructor(public readonly code: "wrong_application" | "wrong_guild" | "commands_unconfirmed" | "commands_cancelled",
    public readonly confirmed = 0, public readonly total = 0, options?: ErrorOptions) {
    super("Discord command registration was not confirmed", options);
  }
}

/** Compare API and discord.js shapes, including settings that can hide a command. */
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
  const permissions = definition.default_member_permissions ?? definition.defaultMemberPermissions;
  return JSON.stringify([definition.type ?? 1, definition.name, definition.description,
    permissions == null ? null : String(permissions.bitfield ?? permissions), !!definition.nsfw,
    (definition.options || []).map(option)]);
}

/** REST does not require a Gateway READY event. No bulk replacement or foreign-command deletion. */
export async function syncRestCommands(rest: Transport, application: string, guild: string, definitions: Definition[],
  hooks: { phase?: (phase: CommandPhase) => void; failure?: (name: string, error: unknown) => void; stopped?: () => boolean } = {}) {
  const phase = (value: CommandPhase) => {
    if (hooks.stopped?.()) throw new CommandRegistrationError("commands_cancelled");
    hooks.phase?.(value);
  };
  phase("application");
  const identity = await rest.get(Routes.currentApplication()) as { id: string };
  if (identity.id !== application) throw new CommandRegistrationError("wrong_application");
  phase("guild");
  const target = await rest.get(Routes.guild(guild)) as { id: string };
  if (target.id !== guild) throw new CommandRegistrationError("wrong_guild");
  const route = Routes.applicationGuildCommands(application, guild);
  const current = await rest.get(route) as Definition[];
  let created = 0, updated = 0, firstFailure: unknown;
  phase("publish");
  for (const definition of definitions) {
    phase("publish");
    const existing = current.find(c => c.name === definition.name && (c.type ?? 1) === 1);
    try {
      if (!existing) { await rest.post(route, { body: definition }); created++; }
      else if (commandShape(existing) !== commandShape(definition)) {
        await rest.patch(Routes.applicationGuildCommand(application, guild, existing.id), { body: definition }); updated++;
      }
    } catch (error) {
      // A rejected definition must not prevent /start, /hilfe or other valid commands from registering.
      firstFailure ??= error; hooks.failure?.(definition.name, error);
    }
  }
  phase("verify");
  const confirmed = await rest.get(route) as Definition[];
  const count = definitions.filter(d => confirmed.some(c => (c.type ?? 1) === 1 && commandShape(c) === commandShape(d))).length;
  if (count !== definitions.length) throw new CommandRegistrationError("commands_unconfirmed", count, definitions.length, { cause: firstFailure });
  phase("registered");
  return { total: definitions.length, confirmed: count, created, updated };
}

/** Audits continue after success; a removed command is repaired on the next audit. */
export class CommandRegistrar {
  ready = false;
  syncing = false;
  lastAttempt = Number.NEGATIVE_INFINITY;
  phase: CommandPhase = "pending";
  confirmed = 0;
  constructor(private readonly perform: () => Promise<{ confirmed: number }>, private readonly clock = Date.now,
    private readonly auditMs = 900_000, private readonly retryMs = 60_000) {}
  async sync(force = false) {
    if (this.syncing || (!force && this.clock() - this.lastAttempt < (this.ready ? this.auditMs : this.retryMs))) return null;
    this.syncing = true; this.lastAttempt = this.clock();
    try { const report = await this.perform(); this.ready = true; this.confirmed = report.confirmed; return report; }
    catch (error) { this.ready = false; this.confirmed = error instanceof CommandRegistrationError ? error.confirmed : 0; throw error; }
    finally { this.syncing = false; }
  }
}

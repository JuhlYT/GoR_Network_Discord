import { describe, expect, test } from "bun:test";
import { Routes, type REST } from "discord.js";
import { CommandRegistrar, CommandRegistrationError, commandShape, syncRestCommands } from "./command_registry";
import { APPLICATION, GUILD, commandDefinitions } from "./gor_network";

function fixture() {
  const entries = new Map<string, any>(), writes: { method: string; body: any }[] = [];
  let application = APPLICATION, target = GUILD;
  let reject = "", responseLost = "";
  const route = Routes.applicationGuildCommands(APPLICATION, GUILD);
  const rest = {
    get: async (path: string) => {
      if (path === Routes.currentApplication()) return { id: application };
      if (path === Routes.guild(GUILD)) return { id: target };
      expect(path).toBe(route); return structuredClone([...entries.values()]);
    },
    post: async (path: string, options: any) => {
      expect(path).toBe(route); const body = options.body;
      writes.push({ method: "POST", body });
      if (reject === body.name) throw Object.assign(new Error("private-request-body"), { code: 50035 });
      entries.set(body.name, { ...structuredClone(body), id: body.name, type: 1 });
      if (responseLost === body.name) throw Object.assign(new Error("private-request-body"), { code: "ETIMEDOUT" });
      return entries.get(body.name);
    },
    patch: async (path: string, options: any) => {
      expect(path).toBe(Routes.applicationGuildCommand(APPLICATION, GUILD, options.body.name));
      writes.push({ method: "PATCH", body: options.body });
      entries.set(options.body.name, { ...structuredClone(options.body), id: options.body.name, type: 1 });
      return entries.get(options.body.name);
    },
  } as unknown as Pick<REST, "get" | "post" | "patch">;
  return { entries, writes, rest, identity: (app: string, guild = GUILD) => { application = app; target = guild; },
    reject: (name: string) => { reject = name; }, responseLost: (name: string) => { responseLost = name; } };
}

describe("Gateway-unabhängige Befehlsregistrierung", () => {
  test("29 guild commands are confirmed by a fresh read; healthy definitions and foreign commands stay intact", async () => {
    const f = fixture(); f.entries.set("foreign", { id: "foreign", name: "foreign", description: "Unmanaged", type: 1 });
    const run = () => syncRestCommands(f.rest, APPLICATION, GUILD, commandDefinitions());
    expect(await run()).toMatchObject({ confirmed: 29, created: 29, updated: 0 });
    f.writes.length = 0;
    expect(await run()).toMatchObject({ confirmed: 29, created: 0, updated: 0 });
    expect(f.writes).toHaveLength(0); expect(f.entries.has("foreign")).toBe(true);
  });
  test("a rejected command does not prevent later commands; the next attempt only repairs the missing command", async () => {
    const f = fixture(); f.reject("faq"); const failures: string[] = [];
    let error: unknown;
    try { await syncRestCommands(f.rest, APPLICATION, GUILD, commandDefinitions(), { failure: name => failures.push(name) }); }
    catch (e) { error = e; }
    expect(error).toBeInstanceOf(CommandRegistrationError);
    expect(error).toMatchObject({ code: "commands_unconfirmed", confirmed: 28, total: 29 });
    expect(f.entries.has("backup")).toBe(true); expect(failures).toEqual(["faq"]);
    f.reject(""); f.writes.length = 0;
    expect(await syncRestCommands(f.rest, APPLICATION, GUILD, commandDefinitions())).toMatchObject({ confirmed: 29, created: 1 });
    expect(f.writes.map(w => w.body.name)).toEqual(["faq"]);
  });
  test("a lost response is confirmed by reading Discord and does not create a duplicate", async () => {
    const f = fixture(); f.responseLost("start");
    expect(await syncRestCommands(f.rest, APPLICATION, GUILD, commandDefinitions())).toMatchObject({ confirmed: 29 });
    expect(f.writes.filter(w => w.body.name === "start")).toHaveLength(1);
  });
  test("wrong application, wrong target and cancellation cannot publish commands", async () => {
    const f = fixture(); f.identity("0");
    await expect(syncRestCommands(f.rest, APPLICATION, GUILD, commandDefinitions())).rejects.toMatchObject({ code: "wrong_application" });
    f.identity(APPLICATION, "0");
    await expect(syncRestCommands(f.rest, APPLICATION, GUILD, commandDefinitions())).rejects.toMatchObject({ code: "wrong_guild" });
    f.identity(APPLICATION);
    await expect(syncRestCommands(f.rest, APPLICATION, GUILD, commandDefinitions(), { stopped: () => true })).rejects.toMatchObject({ code: "commands_cancelled" });
    expect(f.writes).toHaveLength(0);
  });
  test("stale default visibility settings are repaired; existing runtime authorization remains separate", async () => {
    const f = fixture(); await syncRestCommands(f.rest, APPLICATION, GUILD, commandDefinitions());
    f.entries.get("start").default_member_permissions = "0";
    f.entries.get("hilfe").nsfw = true; f.writes.length = 0;
    await syncRestCommands(f.rest, APPLICATION, GUILD, commandDefinitions());
    expect(f.writes.map(w => [w.method, w.body.name])).toEqual([["PATCH", "start"], ["PATCH", "hilfe"]]);
    expect(f.entries.get("start").default_member_permissions).toBeNull(); expect(f.entries.get("hilfe").nsfw).toBe(false);
    expect(commandShape({ name: "x", description: "x", defaultMemberPermissions: { bitfield: 8n } }))
      .toBe(commandShape({ name: "x", description: "x", default_member_permissions: "8" }));
  });
  test("successful registration is audited again and restores a command removed after startup", async () => {
    const f = fixture(); let clock = 0;
    const registrar = new CommandRegistrar(() => syncRestCommands(f.rest, APPLICATION, GUILD, commandDefinitions()), () => clock);
    await registrar.sync(); expect(registrar.ready).toBe(true); f.entries.delete("start"); f.writes.length = 0;
    clock = 899_999; expect(await registrar.sync()).toBeNull(); expect(f.writes).toHaveLength(0);
    clock = 900_000; await registrar.sync();
    expect(f.entries.has("start")).toBe(true); expect(f.writes.map(w => w.body.name)).toEqual(["start"]);
  });
  test("failed audits retry after a minute and overlapping syncs never double-publish", async () => {
    const f = fixture(); let clock = 0; f.reject("faq");
    const registrar = new CommandRegistrar(() => syncRestCommands(f.rest, APPLICATION, GUILD, commandDefinitions()), () => clock);
    await expect(registrar.sync()).rejects.toMatchObject({ confirmed: 28 });
    expect(registrar.ready).toBe(false); f.reject(""); f.writes.length = 0;
    clock = 59_999; expect(await registrar.sync()).toBeNull();
    clock = 60_000; const pending = registrar.sync(); expect(await registrar.sync(true)).toBeNull(); await pending;
    expect(registrar.ready).toBe(true); expect(registrar.confirmed).toBe(29); expect(f.writes.map(w => w.body.name)).toEqual(["faq"]);
  });
});

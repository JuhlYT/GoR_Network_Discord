/** Process fixture: no Discord network requests and no real credential. */
import { EventEmitter } from "node:events";
import { Client, Collection, Events, MessageFlags, PermissionFlagsBits as P } from "discord.js";
import { APPLICATION, GUILD, main } from "../../gor_network";

class FixtureClient extends EventEmitter {
  connected = false;
  application = { id: APPLICATION, fetch: async () => this.application };
  user = { id: Bun.env.GOR_FIXTURE_WRONG_APP === "true" ? "0" : APPLICATION,
    setPresence: (presence: any) => {
      if (presence.status !== "online") throw new Error("Unexpected fixture presence");
      console.log("fixture_presence_online");
      if (Bun.env.GOR_FIXTURE_FLOW) setTimeout(() => this.runFlow(Bun.env.GOR_FIXTURE_FLOW!), 10);
    } };
  entries = new Collection<string, any>();
  commands = {
    fetch: async () => {
      if (Bun.env.GOR_FIXTURE_SYNC_ERROR === "true") throw Object.assign(new Error("private-fixture-body"), { code: 50013 });
      return this.entries;
    },
    create: async (definition: any) => {
      const result = { id: definition.name, name: definition.name, type: 1, toJSON: () => definition };
      this.entries.set(result.id, result); return result;
    },
    edit: async (id: string, definition: any) => {
      const result = { id, name: definition.name, type: 1, toJSON: () => definition };
      this.entries.set(id, result); return result;
    },
  };
  guild: any = { id: GUILD, ownerId: "fixture-owner", commands: this.commands,
    members: {
      fetch: async ({ user }: { user: string }) => ({ id: user, pending: false, guild: this.guild, roles: { cache: new Collection() } }),
      fetchMe: async () => ({ permissions: { has: (permission: bigint) => permission === P.Administrator && Bun.env.GOR_FIXTURE_ADMIN === "true" } }),
    } };
  guilds = { fetch: async (id: string) => { if (id !== GUILD) throw new Error("Unexpected fixture guild"); return this.guild; } };
  isReady() { return this.connected; }
  async login(token: string) {
    if (token !== "fixture-not-a-real-discord-token") throw new Error("Unexpected fixture credential");
    if (Bun.env.GOR_FIXTURE_INVALID_TOKEN === "true") throw Object.assign(new Error("private-fixture-body"), { code: "TokenInvalid" });
    if (Bun.env.GOR_FIXTURE_HANG === "true") return new Promise<string>(() => {});
    this.connected = true; this.emit(Events.ClientReady); return token;
  }
  async destroy() { this.connected = false; }
  runFlow(flow: string) {
    const component = ["public-guide", "private-guide", "private-roles"].includes(flow);
    const privateCard = flow.startsWith("private-");
    const command = ({ start: "start", own: "meine_faelle", team: "team", phase: "projektstatus", project: "projektanfrage", setup: "einrichten", setupstatus: "einrichtung" } as Record<string, string>)[flow] || "start";
    let acknowledgment = "";
    const verify = (payload: any) => {
      if (acknowledgment !== (privateCard ? "update" : "reply")) throw new Error("Incorrect private/public acknowledgment");
      if (payload.allowedMentions?.parse?.length !== 0) throw new Error("Unexpected mention behavior");
      const title = payload.embeds?.[0]?.title || "", body = payload.content || "";
      const valid = flow === "start" || flow === "public-guide" ? title.includes("Willkommen")
        : flow === "private-guide" ? title.includes("Viele Spiele")
        : flow === "private-roles" ? title.includes("Interessen")
        : flow === "own" ? title.includes("Deine Anliegen")
        : flow === "team" ? body.includes("keine Fallzuständigkeit") && !payload.embeds.length
        : flow === "phase" || flow === "setupstatus" ? body.includes("Networkleitung") && !payload.embeds.length
        : flow === "setup" ? body.includes("Serverinhaber") && !payload.embeds.length : false;
      if (!valid) throw new Error("Unexpected flow result");
      console.log("fixture_flow_passed:" + flow);
    };
    const interaction: any = {
      id: "fixture-" + flow, guildId: GUILD, guild: this.guild, user: { id: "fixture-member" }, member: { pending: false },
      deferred: false, replied: false, commandName: command,
      customId: flow === "private-roles" ? "gor:roles:open:v5" : "gor:guide:v5:" + (privateCard ? "spiele" : "start"),
      message: { flags: { has: (flag: number) => flag === MessageFlags.Ephemeral && privateCard } },
      options: { getString: () => null, getInteger: () => 1 },
      isRepliable: () => true, isChatInputCommand: () => !component, isButton: () => component,
      isMessageComponent: () => component, isStringSelectMenu: () => false, isModalSubmit: () => false,
      deferReply: async (options: any) => {
        if (privateCard || options.flags !== MessageFlags.Ephemeral) throw new Error("Expected private reply");
        acknowledgment = "reply"; interaction.deferred = true;
      },
      deferUpdate: async () => {
        if (!privateCard) throw new Error("Attempted to edit public panel");
        acknowledgment = "update"; interaction.deferred = true;
      },
      editReply: async (payload: any) => verify(payload),
      showModal: async (modal: any) => {
        if (flow !== "project" || modal.toJSON().custom_id !== "gor:project:v5" || modal.toJSON().components.length !== 5)
          throw new Error("Project intake route failed");
        console.log("fixture_flow_passed:project");
      },
    };
    this.emit(Events.InteractionCreate, interaction);
  }
}

await main({ createClient: () => new FixtureClient() as unknown as Client,
  startupTimeoutMs: Bun.env.GOR_FIXTURE_HANG === "true" ? 300 : undefined,
  setupRunner: Bun.env.GOR_FIXTURE_SETUP ? async () => {
    console.log("fixture_automatic_setup_called");
    if (Bun.env.GOR_FIXTURE_SETUP === "setup-failure") throw Object.assign(new Error("private-fixture-body"), { code: 50013 });
    return { at: Date.now(), created: 0, updated: 0, unchanged: 1, adopted: 0, issues: [], status: "ready" };
  } : undefined });

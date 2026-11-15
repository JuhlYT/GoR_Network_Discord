/** Process fixture: no Discord network requests and no real credential. */
import { EventEmitter } from "node:events";
import { Client, Collection, Events, PermissionFlagsBits as P } from "discord.js";
import { APPLICATION, GUILD, main } from "../../gor_network";

class FixtureClient extends EventEmitter {
  connected = false;
  application = { id: APPLICATION, fetch: async () => this.application };
  user = { id: Bun.env.GOR_FIXTURE_WRONG_APP === "true" ? "0" : APPLICATION,
    setPresence: (presence: any) => {
      if (presence.status !== "online") throw new Error("Unexpected fixture presence");
      console.log("fixture_presence_online");
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
  guild = { id: GUILD, commands: this.commands,
    members: { fetchMe: async () => ({ permissions: { has: (permission: bigint) => permission === P.Administrator && Bun.env.GOR_FIXTURE_ADMIN === "true" } }) } };
  guilds = { fetch: async (id: string) => { if (id !== GUILD) throw new Error("Unexpected fixture guild"); return this.guild; } };
  isReady() { return this.connected; }
  async login(token: string) {
    if (token !== "fixture-not-a-real-discord-token") throw new Error("Unexpected fixture credential");
    this.connected = true; this.emit(Events.ClientReady); return token;
  }
  async destroy() { this.connected = false; }
}

await main({ createClient: () => new FixtureClient() as unknown as Client });

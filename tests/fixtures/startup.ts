/** Process fixture: no Discord network requests and no real credential. */
import { EventEmitter } from "node:events";
import { Client, Collection, Events, MessageFlags, PermissionFlagsBits as P, Routes } from "discord.js";
import { APPLICATION, GUILD, CHANNELS, ROLES, main } from "../../gor_network";

class FixtureClient extends EventEmitter {
  connected = false;
  setupCalls = 0;
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
      if (definition.name === "faq" && Bun.env.GOR_FIXTURE_PARTIAL_SYNC === "true")
        throw Object.assign(new Error("private-fixture-body"), { code: 50035 });
      const result = { id: definition.name, name: definition.name, type: 1, toJSON: () => definition };
      this.entries.set(result.id, result); return result;
    },
    edit: async (id: string, definition: any) => {
      const result = { id, name: definition.name, type: 1, toJSON: () => definition };
      this.entries.set(id, result); return result;
    },
  };
  rest = {
    setToken: (token: string) => {
      if (token !== "fixture-not-a-real-discord-token") throw new Error("Unexpected fixture credential");
      return this.rest;
    },
    get: async (route: string) => {
      if (Bun.env.GOR_FIXTURE_INVALID_TOKEN === "true") throw Object.assign(new Error("private-fixture-body"), { status: 401 });
      if (route === Routes.currentApplication()) return { id: this.user.id };
      if (route === Routes.guild(GUILD)) return { id: GUILD };
      if (route === Routes.applicationGuildCommands(APPLICATION, GUILD))
        return [...(await this.commands.fetch()).values()].map(c => ({ ...c.toJSON(), id: c.id, type: 1 }));
      throw new Error("Unexpected fixture GET route");
    },
    post: async (route: string, options: any) => {
      if (route !== Routes.applicationGuildCommands(APPLICATION, GUILD)) throw new Error("Unexpected fixture POST route");
      return this.commands.create(options.body);
    },
    patch: async (route: string, options: any) => {
      const name = options.body.name;
      if (route !== Routes.applicationGuildCommand(APPLICATION, GUILD, name)) throw new Error("Unexpected fixture PATCH route");
      return this.commands.edit(name, options.body);
    },
  };
  guild: any = { id: GUILD, ownerId: "fixture-owner", commands: this.commands,
    scheduledEvents:{fetch:async()=>new Collection()},
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
    if(flow==="design-drift") {
      const before=this.setupCalls;
      this.emit(Events.ChannelUpdate,{}, {id:"unrelated",guild:this.guild});
      this.emit(Events.GuildRoleUpdate,{}, {id:ROLES.support,guild:{id:"another-guild"}});
      setTimeout(()=>{
        if(this.setupCalls!==before)throw new Error("Unrelated resources triggered layout writes");
        this.emit(Events.GuildRoleUpdate,{}, {id:ROLES.support,guild:this.guild});
        this.emit(Events.ChannelUpdate,{}, {id:CHANNELS.start,guild:this.guild});
        setTimeout(()=>{
          if(this.setupCalls!==before+1)throw new Error("Managed changes were not coalesced into one repair");
          console.log("fixture_flow_passed:"+flow);
        },30);
      },10);return;
    }
    const component = ["public-guide", "private-guide", "private-roles", "payment", "statusbutton", "design-start", "design-start-temporary", "design-denied", "design-pause", "design-resume"].includes(flow);
    const modalSubmit=flow==="legacy-payment";
    const privateCard = flow.startsWith("private-") || flow.startsWith("design-");
    const command = ({ start: "start", own: "meine_faelle", team: "team", phase: "projektstatus", project: "projektanfrage", setup: "einrichten", setupstatus: "einrichtung",
      legal:"rechtliches",mydata:"meine_daten",privacy:"datenanfrage",complaint:"beschwerde",ideaform:"ideen",ideas:"ideen",events:"events",finance:"finanzbericht",updatedenied:"update_vorschau",financedenied:"finanzbericht" } as Record<string, string>)[flow] || "start";
    let acknowledgment = "";
    const verify = (payload: any) => {
      if (acknowledgment !== (privateCard ? "update" : "reply")) throw new Error("Incorrect private/public acknowledgment");
      if (payload.allowedMentions?.parse?.length !== 0) throw new Error("Unexpected mention behavior");
      const title = payload.embeds?.[0]?.title || "", body = payload.content || "";
      const valid = flow==="design-start" || flow==="design-start-temporary" ? body.includes("Servergestaltung wurde gestartet")
        : flow==="design-denied" ? body.includes("Serverinhaber")
        : flow==="design-pause" ? body.includes("Servergestaltung ist pausiert")
        : flow==="design-resume" ? body.includes("Servergestaltung ist aktiviert")
        : flow === "start" || flow === "public-guide" ? title.includes("Willkommen")
        : flow === "private-guide" ? title.includes("Viele Spiele")
        : flow === "private-roles" ? title.includes("Interessen")
        : flow === "own" ? title.includes("Deine Anliegen")
        : flow === "team" ? body.includes("keine Fallzuständigkeit") && !payload.embeds.length
        : flow === "phase" || flow === "setupstatus" ? body.includes("Networkleitung") && !payload.embeds.length
        : flow === "setup" || flow==="updatedenied" ? body.includes("Serverinhaber") && !payload.embeds.length
        : flow==="financedenied" ? body.includes("Finanzzuständigkeit") && !payload.embeds.length
        : flow==="legal" ? title.includes("Rechtliches")
        : flow==="mydata" ? title.includes("Deine eigenen Botdaten")
        : flow==="payment" || flow==="legacy-payment" ? title.includes("Zahlungsfragen")
        : flow==="statusbutton" ? title.includes("Betrieb & Kontakt")
        : flow==="ideas" ? title.includes("Ideen mit")
        : flow==="events" ? title.includes("Gemeinsam etwas erleben")
        : flow==="finance" ? title.includes("Geprüfter Finanzbericht") : false;
      if (!valid) throw new Error("Unexpected flow result");
      if(flow==="design-pause") {
        const before=this.setupCalls;
        this.emit(Events.ChannelUpdate,{}, {id:CHANNELS.start,guild:this.guild});
        setTimeout(()=>{
          if(this.setupCalls!==before)throw new Error("Paused layout reacted to a managed change");
          console.log("fixture_flow_passed:"+flow);
        },30);return;
      }
      console.log("fixture_flow_passed:" + flow);
    };
    const interaction: any = {
      id: "fixture-" + flow, guildId: GUILD, guild: this.guild, user: { id: flow.startsWith("design-") && flow!=="design-denied" ? "fixture-owner" : "fixture-member" }, member: { pending: false },
      deferred: false, replied: false, commandName: command,
      customId: flow==="design-pause"?"gor:setup:pause:v6":flow==="design-resume"?"gor:setup:resume:v6":
        flow.startsWith("design-")?"gor:setup:start:v6":flow === "private-roles" ? "gor:roles:open:v5" : flow==="payment"?"gor44:payment":flow==="legacy-payment"?"gor:case:zahlung":flow==="statusbutton"?"gor44:status":"gor:guide:v5:" + (privateCard ? "spiele" : "start"),
      message: { flags: { has: (flag: number) => flag === MessageFlags.Ephemeral && privateCard } },
      options: { getString: (name:string) => name==="aktion" && flow==="ideaform"?"vorschlagen":name==="aktion" && flow==="financedenied"?"entwurf":null,
        getInteger: () => null,getBoolean:()=>false,getUser:()=>null,getNumber:()=>null },
      fields:{getTextInputValue:()=>{throw new Error("A legacy payment payload must never be read");}},
      isRepliable: () => true, isChatInputCommand: () => !component && !modalSubmit, isButton: () => component,
      isMessageComponent: () => component, isStringSelectMenu: () => false, isModalSubmit: () => modalSubmit,
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
        const data=modal.toJSON(),wanted=({project:"gor:project:v5",privacy:"gor44:privacy:auskunft",complaint:"gor44:complaint:none",ideaform:"gor44:idea:new"} as Record<string,string>)[flow];
        if(!wanted || data.custom_id!==wanted || (flow==="project" && data.components.length!==5))throw new Error("Modal routing failed");
        if(acknowledgment)throw new Error("A modal was deferred before being shown");
        console.log("fixture_flow_passed:"+flow);
      },
    };
    this.emit(Events.InteractionCreate, interaction);
  }
}

const fixtureClient=new FixtureClient();
await main({ createClient: () => fixtureClient as unknown as Client, setupDebounceMs:5,
  startupTimeoutMs: Bun.env.GOR_FIXTURE_HANG === "true" ? 300 : undefined,
  setupRunner: Bun.env.GOR_FIXTURE_SETUP ? async context => {
    fixtureClient.setupCalls++;
    const temporary=!Bun.env.RAILWAY_VOLUME_MOUNT_PATH;
    if(context.allowCreate===temporary)throw new Error("Unsafe or unnecessarily blocked setup policy");
    console.log("fixture_automatic_setup_called");
    if (Bun.env.GOR_FIXTURE_SETUP === "setup-failure") throw Object.assign(new Error("private-fixture-body"), { code: 50013 });
    return { at: Date.now(), created: 0, updated: 0, unchanged: 1, adopted: 0, issues: [], status: "ready" };
  } : undefined });

import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ChannelType, PermissionFlagsBits as P, GuildOnboarding, type Guild } from "discord.js";
import { Store, APPLICATION, GUILD } from "./gor_network";
import { AutoSetup, adoptSetupResource, hydrateManagedMaps, issueCode, type SetupContext } from "./auto_setup";
import { SetupJournal } from "./setup_journal";
import { LAYOUT, LEGACY_MESSAGE_IDS } from "./server_blueprint";
import { MESSAGE_KEYS, setupMessage } from "./server_content";
import { profileOverwrites, overwriteShape } from "./setup_permissions";
import { LayoutFixture } from "./tests/fixtures/layout";
import { onboardingShape, desiredOnboarding } from "./setup_native";
import { followSetup, setupResultView } from "./setup_controls";

const paths: string[] = [], stores: Store[] = [];
function context(fixture = new LayoutFixture()): SetupContext {
  const path = mkdtempSync(join(tmpdir(), "gor-auto-")); paths.push(path); const storage = new Store(path); stores.push(storage);
  return { guild: fixture as unknown as Guild, target: GUILD, application: APPLICATION, maps: fixture.maps(), storage };
}
afterEach(() => { for (const s of stores.splice(0)) try { s.close(); } catch {} for (const path of paths.splice(0)) rmSync(path, { recursive: true, force: true }); });

describe("Automatische GoR-Einrichtung", () => {
  test("ein leerer Server erhält den vollständigen Aufbau und ein zweiter Lauf erzeugt keine Discord-Schreibzugriffe", async () => {
    const server = new LayoutFixture(), ctx = context(server), first = await new AutoSetup(ctx).run();
    expect(first.issues).toEqual([]); expect(first.status).toBe("ready");
    expect(server.roleRows.size).toBe(18); expect(server.channelRows.size).toBe(51);
    expect([...server.channelRows.values()].reduce((n, ch) => n + ch.rows.size, 0)).toBe(11);
    expect(server.native.enabled).toBe(true); expect(server.native.prompts).toHaveLength(2);
    expect(server.ruleRows.size).toBe(1); expect(server.me.nickname).toBe("GoR · Community");
    server.calls = []; const second = await new AutoSetup(ctx).run();
    expect(second.issues).toEqual([]); expect(second.created).toBe(0); expect(second.updated).toBe(0); expect(server.calls).toEqual([]);
  });
  test("alle neu angelegten Kategorien und Kanäle sind vor ihrer Freigabe für normale Mitglieder verborgen", async () => {
    const server = new LayoutFixture(), ctx = context(server); await new AutoSetup(ctx).run();
    const creates = server.calls.filter(c => c.action === "channel.create"); expect(creates).toHaveLength(51);
    for (const call of creates) {
      const everyone = call.payload.permissionOverwrites.find((o: any) => o.id === GUILD);
      expect(everyone.deny & P.ViewChannel).toBe(P.ViewChannel);
    }
    const finance = server.channelRows.get(ctx.maps.channels.finanzbelege);
    expect(finance.permissionOverwrites.cache.get(GUILD).deny.has(P.ViewChannel)).toBe(true);
    expect(finance.permissionOverwrites.cache.has(ctx.maps.roles.finanzen)).toBe(true);
    expect(finance.permissionOverwrites.cache.has(ctx.maps.roles.moderation)).toBe(false);
    expect(finance.permissionOverwrites.cache.has(ctx.maps.roles.technik)).toBe(false);
  });
  test("zusätzliche Kanäle, Mitgliedsrollen und private Fallkanäle bleiben erhalten", async () => {
    const server = new LayoutFixture(), role = server.makeRole(undefined, "Eigene Einheit", { color: 123 }), privateCase = server.makeChannel(undefined, "fall-7777", { topic: "gor-case:7777" });
    const ctx = context(server); await new AutoSetup(ctx).run();
    expect(server.roleRows.get(role.id).name).toBe("Eigene Einheit"); expect(server.roleRows.get(role.id).color).toBe(123);
    expect(server.channelRows.get(privateCase.id).topic).toBe("gor-case:7777"); expect(privateCase.rows.size).toBe(0);
    expect(server.calls.some(call => call.id === privateCase.id)).toBe(false);
  });
  test("Abweichungen an verwalteten Bereichen werden repariert und bestehende Nachrichten aktualisiert", async () => {
    const server = new LayoutFixture(), ctx = context(server); await new AutoSetup(ctx).run();
    const channel = server.channelRows.get(ctx.maps.channels.start), original = [...channel.rows.keys()];
    channel.name = "alter-name"; channel.topic = "Veraltet"; [...channel.rows.values()][0].embeds = [];
    server.calls = []; const report = await new AutoSetup(ctx).run();
    expect(report.issues).toEqual([]); expect(channel.name).toBe("start"); expect(channel.rows.size).toBe(1);
    expect([...channel.rows.keys()]).toEqual(original); expect(server.calls.some(c => c.action === "message.edit")).toBe(true);
    expect(server.calls.some(c => c.action.endsWith(".create"))).toBe(false);
  });
  test("eine verlorene Anlageantwort wird anhand der gespeicherten Kennung ohne doppelte Rolle wiederaufgenommen", async () => {
    const server = new LayoutFixture(); server.lostRole = "after"; const ctx = context(server);
    const first = await new AutoSetup(ctx).run(); expect(first.issues.some(i => i.key === "role:networkleitung")).toBe(true);
    const count = server.calls.filter(c => c.action === "role.create").length;
    const second = await new AutoSetup(ctx).run(); expect(second.issues).toEqual([]);
    expect(server.calls.filter(c => c.action === "role.create")).toHaveLength(count);
    expect(server.roleRows.filter(r => r.name === "Networkleitung").size).toBe(1);
  });
  test("eine unklare Anlage ohne gefundenen Eintrag wird nicht auf Verdacht wiederholt", async () => {
    const server = new LayoutFixture(); server.lostRole = "before"; const ctx = context(server);
    await new AutoSetup(ctx).run(); const count = server.calls.filter(c => c.action === "role.create").length;
    const second = await new AutoSetup(ctx).run();
    expect(second.issues).toContainEqual({ key: "role:networkleitung", code: "creation_unknown" });
    expect(server.calls.filter(c => c.action === "role.create")).toHaveLength(count);
    const existing = server.makeRole(undefined, "Networkleitung"); await adoptSetupResource(ctx, "role:networkleitung", existing.id);
    expect((await new AutoSetup(ctx).run()).issues).toEqual([]);
  });
  test("neue IDs werden nach einem Neustart aus dem Journal wieder in den Bot geladen", async () => {
    const server = new LayoutFixture(), ctx = context(server); await new AutoSetup(ctx).run();
    const mappings = server.maps(); expect(mappings.channels.start).not.toBe(ctx.maps.channels.start);
    hydrateManagedMaps(ctx.storage, mappings); expect(mappings).toEqual(ctx.maps);
  });
  test("Namenskonflikte werden gemeldet und weder fremde Einträge umgenutzt noch Duplikate erstellt", async () => {
    const server = new LayoutFixture(), conflict = server.makeRole(undefined, "Support", { color: 99 }); const ctx = context(server);
    const report = await new AutoSetup(ctx).run();
    expect(report.issues).toContainEqual({ key: "role:support", code: "name_conflict" });
    expect(server.roleRows.filter(r => r.name === "Support").size).toBe(1); expect(conflict.color).toBe(99);
  });
  test("verweigert Discord die Reparatur interner Rechte, bleibt die native Rollenvergabe pausiert", async () => {
    const server = new LayoutFixture(), ctx = context(server); await new AutoSetup(ctx).run();
    const finance = server.channelRows.get(ctx.maps.channels.finanzbelege); finance.permissionOverwrites.cache = server.overwrite([{ id: GUILD, type: 0, allow: P.ViewChannel }]);
    server.denied.add("channel.edit:" + finance.id); const report = await new AutoSetup(ctx).run();
    expect(report.issues).toContainEqual({ key: "channel:finanzbelege", code: "missing_permissions" });
    expect(report.issues).toContainEqual({ key: "onboarding:questions", code: "role_safety" }); expect(server.native.enabled).toBe(false);
  });
  test("ein zusätzlicher interner Zugriff einer Auswahlrolle verhindert neue native Zuweisungen", async () => {
    const server = new LayoutFixture(), ctx = context(server); await new AutoSetup(ctx).run();
    server.makeChannel(undefined, "privat-zusaetzlich", { permissionOverwrites: { cache: server.overwrite([{ id: ctx.maps.roles["ping-events"], type: 0, allow: P.ViewChannel }]) } });
    const report = await new AutoSetup(ctx).run(); expect(server.native.enabled).toBe(false);
    expect(report.issues).toContainEqual({ key: "onboarding:questions", code: "role_safety" });
  });
  test("fremde AutoMod-Regeln bleiben erhalten und private Inhalte werden nicht in Teamkanäle weitergeleitet", async () => {
    const server = new LayoutFixture(), external = { id: server.next(), creatorId: "another-app", triggerType: 5, enabled: true, name: "Vorhandener Schutz" };
    server.ruleRows.set(external.id, external); const ctx = context(server); await new AutoSetup(ctx).run();
    expect(server.ruleRows.size).toBe(1); expect(server.ruleRows.get(external.id)).toEqual(external);
    server.ruleRows.clear(); await new AutoSetup(ctx).run();
    expect([...server.ruleRows.values()][0].actions.map((a: any) => a.type)).toEqual([1]);
  });
  test("eine falsche Anwendung ändert nichts und eine vorhandene Sperre verhindert parallele Läufe", async () => {
    const server = new LayoutFixture(), ctx = context(server); server.client.user.id = "wrong";
    await expect(new AutoSetup(ctx).run()).rejects.toThrow(); expect(server.calls).toEqual([]);
    server.client.user.id = APPLICATION; const journal = new SetupJournal(ctx.storage.db); expect(journal.acquire("another-run")).toBe(true);
    expect((await new AutoSetup(ctx).run()).issues).toContainEqual({ key: "setup", code: "lease_busy" }); expect(server.calls).toEqual([]);
  });
  test("private Fallkanäle und fremde Nachrichten können nicht als öffentlicher Bereich zugeordnet werden", async () => {
    const server = new LayoutFixture(), ctx = context(server), privateCase = server.makeChannel(undefined, "fall", { topic: "gor-case:1" });
    await expect(adoptSetupResource(ctx, "channel:start", privateCase.id)).rejects.toThrow();
    await expect(adoptSetupResource(ctx, "role:unknown", server.me.roles.highest.id)).rejects.toThrow();
  });
  test("alle Infotafeln bleiben innerhalb der Discord-Grenzen und verwenden richtige Zielkanäle", () => {
    const maps = new LayoutFixture().maps();
    for (const key of MESSAGE_KEYS) {
      const message = setupMessage(key, maps.channels); let size = 0;
      for (const embed of message.embeds) {
        expect(embed.description!.length).toBeLessThanOrEqual(4096); size += embed.title!.length + embed.description!.length + embed.footer!.text.length;
        for (const field of embed.fields || []) { expect(field.value.length).toBeLessThanOrEqual(1024); size += field.name.length + field.value.length; }
      }
      expect(size).toBeLessThanOrEqual(6000); expect(JSON.stringify(message)).not.toContain("<#undefined>");
    }
    expect(LAYOUT.categories.flatMap(c => c.channels)).toHaveLength(41);
  });
  test("gespeicherte Fehler enthalten keine fremden Fehlertexte oder Zugangsdaten", () => {
    expect(issueCode({ code: 50013, message: "fixture-secret" })).toBe("missing_permissions");
    expect(issueCode({ setupCode: "fixture-secret" })).toBe("unexpected_error");
    const maps = new LayoutFixture().maps();
    const permission = profileOverwrites("finance_private", GUILD, APPLICATION, maps.roles);
    expect(overwriteShape(permission)).not.toContain(maps.roles.moderation);
  });
  test("das echte Discord-Onboardingmodell bestätigt dieselben Fragen und behält ihre vorhandenen IDs", async () => {
    const server = new LayoutFixture(), ctx = context(server); await new AutoSetup(ctx).run();
    const current = server.native;
    const raw = { guild_id: GUILD, enabled: current.enabled, mode: current.mode, default_channel_ids: current.defaultChannels,
      prompts: current.prompts.map((p: any) => ({ id: p.id, title: p.title, type: p.type, single_select: p.singleSelect, required: p.required, in_onboarding: p.inOnboarding,
        options: p.options.map((o: any) => ({ id: o.id, title: o.title, description: o.description, channel_ids: o.channels, role_ids: o.roles, emoji: {} })) })) };
    const adapted = Reflect.construct(GuildOnboarding, [server.client, raw]);
    const desired = desiredOnboarding(ctx.maps.channels, ctx.maps.roles, adapted);
    expect(onboardingShape(adapted)).toBe(onboardingShape(desired));
    expect(desired.prompts[0].id).toBe(current.prompts[0].id);
  });
  test("eine Auswahlrolle über der Botrolle wird nicht über natives Onboarding vergeben", async () => {
    const server = new LayoutFixture(), ctx = context(server); await new AutoSetup(ctx).run();
    server.roleRows.get(ctx.maps.roles["cw-spieler"]).position = 20000;
    const result = await new AutoSetup(ctx).run(); expect(server.native.enabled).toBe(false);
    expect(result.issues).toContainEqual({ key: "onboarding:questions", code: "role_safety" });
  });
  test("eine unklare Menüanlage wird über den genauen Inhalt wiedergefunden", async () => {
    const server = new LayoutFixture(), ctx = context(server); await new AutoSetup(ctx).run();
    const journal = new SetupJournal(ctx.storage.db), id = ctx.storage.setting("community_panel_message_id")!;
    ctx.storage.db.query("DELETE FROM managed_resources WHERE key='message:start'").run();
    journal.begin("message:start"); ctx.storage.setting("community_panel_message_id", "pending");
    const before = server.calls.filter(c => c.action === "message.create").length;
    const result = await new AutoSetup(ctx).run(); expect(result.issues).toEqual([]);
    expect(ctx.storage.setting("community_panel_message_id")).toBe(id);
    expect(server.calls.filter(c => c.action === "message.create")).toHaveLength(before);
  });
  test("zusätzliche Onboardingfragen werden bei der GoR-Einrichtung erhalten", async () => {
    const server = new LayoutFixture(), ctx = context(server);
    server.native.prompts = [{ id: "1999999999999999000", title: "Zusätzliche Frage", type: 0, singleSelect: false, required: false, inOnboarding: false,
      options: [{ id: "1999999999999999001", title: "Option", description: "Eigene Auswahl", channels: [], roles: [] }] }];
    await new AutoSetup(ctx).run(); expect(server.native.prompts).toHaveLength(3);
    expect(server.native.prompts[2].id).toBe("1999999999999999000");
  });
  test("zwei Datenbankverbindungen reservieren dieselbe Anlage nur einmal und erkennen verlorene Sperren", () => {
    const ctx = context(), first = new SetupJournal(ctx.storage.db), otherStore = new Store((ctx.storage as Store).directory); stores.push(otherStore);
    const second = new SetupJournal(otherStore.db), a = first.begin("role:support"), b = second.begin("role:support");
    expect(a.fresh).toBe(true); expect(b.fresh).toBe(false); expect(a.record.marker).toBe(b.record.marker);
    expect(first.acquire("one")).toBe(true); expect(second.acquire("two")).toBe(false);
    ctx.storage.db.query("UPDATE setup_lease SET expires=0").run();
    expect(second.acquire("two")).toBe(true); expect(first.renew("one")).toBe(false);
  });
  test("fremde Nachrichtenzuordnungen werden weder bearbeitet noch als eigener Menüinhalt übernommen", async () => {
    const server = new LayoutFixture(), ctx = context(server); await new AutoSetup(ctx).run();
    const channel = server.channelRows.get(ctx.maps.channels.start), foreign = await channel.send(setupMessage("start", ctx.maps.channels));
    foreign.author.id = "another-app"; new SetupJournal(ctx.storage.db).bind("message:start", foreign.id); server.calls = [];
    const report = await new AutoSetup(ctx).run();
    expect(report.issues).toContainEqual({ key: "message:start", code: "not_owned" });
    expect(server.calls.some(c => c.action === "message.edit" && c.id === foreign.id)).toBe(false);
    await expect(adoptSetupResource(ctx, "message:start", foreign.id)).rejects.toThrow();
  });
});

describe("Servergestaltung ohne dauerhaftes Fallarchiv", () => {
  test("bekannte Bereiche und eigene Infotafeln werden auch nach einem frischen Start ohne neue Anlagen repariert", async () => {
    const server=new LayoutFixture(), original=context(server);
    await new AutoSetup(original).run();
    for(const key of MESSAGE_KEYS) {
      const channel=server.channelRows.get(original.maps.channels[key]), [message]=[...channel.rows.values()];
      channel.rows.clear();message.id=LEGACY_MESSAGE_IDS[key];channel.rows.set(message.id,message);
    }
    const fresh=context(server);fresh.maps=structuredClone(original.maps);fresh.allowCreate=false;
    const start=server.channelRows.get(fresh.maps.channels.start);
    start.name="veraltet";start.topic="Alter Text";[...start.rows.values()][0].embeds=[];
    server.roleRows.get(fresh.maps.roles.support).color=123;
    server.calls=[];
    const report=await new AutoSetup(fresh).run();
    expect(report.issues).toEqual([]);
    expect(start.name).toBe("start");expect(start.topic).toContain("Willkommen");
    expect(fresh.storage.setting("community_panel_message_id")).toBe(LEGACY_MESSAGE_IDS.start);
    expect(server.roleRows.get(fresh.maps.roles.support).color).toBe(LAYOUT.roles.find(r=>r.key==="support")!.color);
    expect(server.calls.some(call=>call.action.endsWith(".create"))).toBe(false);
    expect(server.calls.some(call=>call.action==="message.edit")).toBe(true);
  });
  test("ein fehlendes dauerhaftes Journal verhindert alle neuen Discord-Anlagen", async () => {
    const server=new LayoutFixture(),ctx=context(server);ctx.allowCreate=false;
    const report=await new AutoSetup(ctx).run();
    expect(report.issues).toContainEqual({key:"role:networkleitung",code:"storage_required"});
    expect(server.channelRows.size).toBe(0);expect(server.roleRows.size).toBe(2);
    expect(server.calls.some(call=>call.action.endsWith(".create"))).toBe(false);
  });
  test("eine gelöschte Rolle wird gemeldet, während andere bekannte Bereiche weiter gestaltet werden", async () => {
    const server=new LayoutFixture(),ctx=context(server);await new AutoSetup(ctx).run();
    server.roleRows.delete(ctx.maps.roles.creator);
    const lounge=server.channelRows.get(ctx.maps.channels.lounge);lounge.name="falsch";
    ctx.allowCreate=false;server.calls=[];
    const report=await new AutoSetup(ctx).run();
    expect(report.issues).toContainEqual({key:"role:creator",code:"storage_required"});
    expect(lounge.name).toBe("lounge");
    expect(server.calls.some(call=>call.action.endsWith(".create"))).toBe(false);
  });
  test("fehlende Infotafeln und AutoMod-Regeln werden ohne Journal nicht ungesichert veröffentlicht", async () => {
    const server=new LayoutFixture(),ctx=context(server);await new AutoSetup(ctx).run();
    server.channelRows.get(ctx.maps.channels.start).rows.clear();server.ruleRows.clear();
    ctx.allowCreate=false;server.calls=[];
    const report=await new AutoSetup(ctx).run();
    expect(report.issues).toContainEqual({key:"message:start",code:"storage_required"});
    expect(report.issues).toContainEqual({key:"automod:mentions",code:"storage_required"});
    expect(server.calls.some(call=>call.action.endsWith(".create"))).toBe(false);
  });
});

describe("Bestätigtes Einrichtungsergebnis statt bloßer Startmeldung", () => {
  test("jeder Einrichtungsschritt meldet geordneten Fortschritt bis zum tatsächlichen Abschluss", async () => {
    const server=new LayoutFixture(),ctx=context(server),progress:any[]=[];
    ctx.onProgress=value=>{progress.push({...value});};
    const report=await new AutoSetup(ctx).run(), last=progress.at(-1);
    expect(report.status).toBe("ready");
    expect(last.completed).toBe(last.total);expect(last.total).toBe(84);
    expect(progress.some(p=>p.key==="role:support")).toBe(true);
    expect(progress.some(p=>p.key==="message:start")).toBe(true);
    expect(progress.every((p,i)=>!i||p.completed>=progress[i-1].completed)).toBe(true);
    expect(last.created).toBe(report.created);expect(last.updated).toBe(report.updated);
  });
  test("ein ausgefallener Fortschrittskanal verhindert keine Discord-Gestaltung", async () => {
    const server=new LayoutFixture(),ctx=context(server);
    ctx.onProgress=async()=>{throw new Error("private-fixture-body");};
    const report=await new AutoSetup(ctx).run();
    expect(report.status).toBe("ready");expect(server.channelRows.size).toBe(51);
  });
  test("eine ausstehende Einrichtung erhält erst nach ihrem Ergebnis eine Abschlussmeldung", async () => {
    let finish!:(value:any)=>void;
    const job=new Promise<any>(resolve=>{finish=resolve;}),replies:any[]=[];
    const following=followSetup({version:"fixture",storage:"persistent",allowCreate:true,
      task:()=>job,progress:()=>undefined,reply:async view=>{replies.push(view);},intervalMs:1000});
    await Promise.resolve();
    expect(replies).toHaveLength(1);expect(replies[0].embeds[0].title).toContain("läuft");
    finish({at:1,created:0,updated:0,unchanged:84,adopted:0,issues:[],status:"ready"});
    await following;
    expect(replies.at(-1).embeds[0].title).toContain("Bereits passend");
    expect(replies.at(-1).embeds[0].description).toContain("keine sichtbaren Änderungen");
    expect(replies.at(-1).files).toHaveLength(1);
  });
  test("ein fehlender oder abgebrochener Lauf wird nicht als erfolgreicher Abschluss dargestellt", async () => {
    for(const task of [()=>Promise.resolve(undefined),()=>Promise.reject(new Error("private-fixture-body"))]) {
      const replies:any[]=[];
      await followSetup({version:"fixture",storage:"temporary",allowCreate:false,
        task,progress:()=>undefined,reply:async view=>{replies.push(view);}});
      expect(replies.at(-1).embeds[0].title).toContain("Kein Abgleich bestätigt");
      expect(JSON.stringify(replies)).not.toContain("private-fixture-body");
    }
  });
  test("blockierte Änderungen nennen Ursache und nächsten Schritt im tatsächlichen Ergebnis", () => {
    const report={at:1,created:0,updated:0,unchanged:0,adopted:0,status:"attention",issues:[
      {key:"role:networkleitung",code:"role_uneditable"},{key:"channel:start",code:"missing_permissions"},{key:"message:start",code:"storage_required"}]};
    const view=setupResultView(report,{version:"fixture",storage:"temporary",allowCreate:false}),text=view.embeds[0].description!;
    expect(view.embeds[0].title).toContain("offenen Punkten");
    expect(text).toContain("Botrolle");expect(text).toContain("Volume");expect(text).toContain("Kanäle verwalten");
    expect(text.length).toBeLessThanOrEqual(4096);
  });
});

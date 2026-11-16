import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Collection, GuildScheduledEventPrivacyLevel, PermissionsBitField, PermissionFlagsBits as P, type Guild } from "discord.js";
import { Store, GUILD, APPLICATION, VERSION } from "./gor_network";
import { Update44 } from "./update44";
import { CommunityState } from "./community_state";
import { legalConfig, publicUrl, saveLegalLinks, legalDigest } from "./legal_config";
import { restoreSnapshot } from "./restore_backup";
import { reviewAssignedAccess } from "./access_review";
import { addMonth, DAY, timestamp } from "./feature_base";
import { Retention } from "./retention";
import { encryptBackup, decryptBackup, RemoteBackup, backupKey } from "./backup_remote";
import { captureChangePlan, setProtection } from "./change_plan";
import { AutoSetup } from "./auto_setup";
import { LayoutFixture } from "./tests/fixtures/layout";
import { eventDraft, financeBalance, financeReport, publishEvent, recoverEvent } from "./community_actions";

const directories:string[]=[], stores:Store[]=[];
const ALICE="1700000000000000001", BOB="1700000000000000002", OWNER="1700000000000000003", THIRD="1700000000000000004";
function store() {const dir=mkdtempSync(join(tmpdir(),"gor44-"));directories.push(dir);const s=new Store(dir);stores.push(s);return s;}
function fixture() {
  const s=store(),guild=new LayoutFixture(),answers:any[]=[],created:any[]=[];
  const member=(id=ALICE,roles:string[]=[])=>({id,guild:{...guild,ownerId:OWNER},roles:{cache:new Collection(roles.map(k=>[guild.maps().roles[k],{}]))}} as any);
  const features=new Update44({store:s,env:{},guild:GUILD,application:APPLICATION,version:VERSION,maps:guild.maps(),answer:async(_i,c,extra)=>{answers.push({content:c,...extra});},
    createCase:async(_i,m,kind,preset)=>{created.push({actor:m.id,kind,preset});},caseChannel:async()=>{throw new Error("No fixture channel");},serial:async fn=>fn(),
    applySetup:async before=>{await before();return {at:Date.now(),created:0,updated:0,unchanged:1,adopted:0,issues:[],status:"ready"};},status:()=>({connected:true,commands:true,commandCount:39,commandTotal:39,setup:"ready",storage:"persistent"})});
  return {s,guild,features,answers,created,member};
}
function interaction(command:string,strings:Record<string,string>={},integers:Record<string,number>={}) {
  return {commandName:command,isChatInputCommand:()=>true,isModalSubmit:()=>false,isButton:()=>false,isStringSelectMenu:()=>false,
    options:{getString:(k:string)=>strings[k]??null,getInteger:(k:string)=>integers[k]??null,getBoolean:()=>false,getUser:()=>null,getNumber:()=>null}} as any;
}
afterEach(()=>{for(const s of stores.splice(0))try{s.close();}catch{}for(const d of directories.splice(0))rmSync(d,{recursive:true,force:true});});

describe("4.4 Kontakt, Formulare und eigene Daten",()=>{
  test("fehlende Kontakte erzeugen keine erfundenen oder ungültigen Links",async()=>{
    const f=fixture();expect(f.features.publicLinks()).toEqual({});
    await f.features.legal({});expect(f.answers[0].components).toEqual([]);expect(f.answers[0].embeds[0].description).toContain("werden noch ergänzt");
    await f.features.payment({});expect(f.answers[1].embeds[0].description).toContain("noch nicht hinterlegt");
  });
  test("öffentliche Links akzeptieren keine Zugangsdaten, Tokenparameter oder unsicheren Schemes",()=>{
    expect(publicUrl("https://example.org/datenschutz")).toBe("https://example.org/datenschutz");
    for(const value of ["http://example.org","javascript:alert(1)","https://me:secret@example.org/a","https://example.org/a?token=private","https://127.0.0.1/a","https://example.org:8443/a"])
      expect(()=>publicUrl(value)).toThrow();
  });
  test("eine Kontaktänderung widerruft die alte Betreiberbestätigung",()=>{
    const s=store();s.setting("legal_reviewed_v44","true");saveLegalLinks(s,{privacy:"https://example.org/privacy"});
    expect(legalConfig(s).reviewed).toBe(false);expect(legalConfig(s).ready).toBe(false);
  });
  test("auch eine Änderung der Laufzeitlinks macht die alte Linkprüfung ungültig",()=>{
    const s=store();saveLegalLinks(s,{privacy:"https://example.org/alt"});s.setting("legal_reviewed_v44","true");s.setting("legal_review_digest_v44",legalDigest(legalConfig(s).links));
    expect(legalConfig(s).reviewed).toBe(true);expect(legalConfig(s,{GOR_PRIVACY_URL:"https://example.org/neu"}).reviewed).toBe(false);
  });
  test("alle neuen Formulare passieren den echten Discord-Builder und seine Grenzen",()=>{
    const f=fixture();const inputs=[interaction("datenanfrage"),interaction("beschwerde"),interaction("einspruch"),interaction("ideen",{aktion:"vorschlagen"}),
      {user:{id:OWNER},guild:{ownerId:OWNER},customId:"gor44:settings",isButton:()=>true}];
    for(const i of inputs){const form=f.features.modalFor(i);expect(form).not.toBeNull();const json=form!.toJSON();
      expect(json.custom_id.length).toBeLessThanOrEqual(100);expect(json.components.length).toBeLessThanOrEqual(5);
      for(const row of json.components as any[])for(const field of row.components){expect(field.label.length).toBeLessThanOrEqual(45);expect(field.placeholder.length).toBeLessThanOrEqual(100);}}
  });
  test("Datenschutzfragen und Beschwerden bekommen begrenzte Metadaten statt öffentlicher Teamdetails",async()=>{
    const f=fixture();const i={customId:"gor44:privacy:loeschung",isChatInputCommand:()=>false,isModalSubmit:()=>true,fields:{getTextInputValue:()=>"Bitte meine Daten prüfen."}};
    await f.features.handle(i,f.member());expect(f.created).toEqual([{actor:ALICE,kind:"datenschutz",preset:{summary:"Löschung",details:"Bitte meine Daten prüfen.",requestType:"loeschung"}}]);
  });
  test("Beteiligte Teammitglieder dürfen Beschwerden und eigene Datenschutzanfragen nicht übernehmen",()=>{
    const f=fixture(),c=f.s.reserve(ALICE,"beschwerde");f.features.state.open(c,{summary:"x",details:"x",excluded:[BOB]});
    expect(f.features.canHandle(c,f.member(BOB,["moderation"]),true)).toBe(false);
    expect(f.features.canHandle(c,f.member(ALICE,["moderation"]),true)).toBe(false);
    expect(f.features.canHandle(c,f.member(THIRD,["moderation"]),true)).toBe(true);
    const p=f.s.reserve(THIRD,"datenschutz",timestamp()+61);f.features.state.open(p,{summary:"x",details:"x",requestType:"auskunft"});
    expect(f.features.canHandle(p,f.member(BOB,["support"]),true)).toBe(false);
    f.s.setting("privacy_contacts_v44",BOB);expect(f.features.canHandle(p,f.member(BOB),false)).toBe(true);
  });
  test("Eigenauskunft enthält weder fremde Fälle noch Bearbeiter- oder Ressourcen-IDs",()=>{
    const f=fixture(),a=f.s.reserve(ALICE,"allgemein"),b=f.s.reserve(BOB,"allgemein");f.features.state.open(a);f.features.state.open(b);
    f.s.change(a.id,{assignee_id:THIRD});f.s.audit(ALICE,"case_claim","private-resource-of-third");
    f.features.state.createIdea(BOB,"Fremde Idee","Fremder geheimer Inhalt");
    const data=f.features.state.myData(ALICE),serialized=JSON.stringify(data);
    expect(data.cases).toHaveLength(1);expect(serialized).not.toContain(THIRD);expect(serialized).not.toContain("private-resource-of-third");expect(serialized).not.toContain("Fremder geheimer Inhalt");
  });
  test("interner Monatsprüftermin behandelt Monatsenden korrekt",()=>{
    const input=Date.UTC(2026,0,31,12)/1000;expect(new Date(addMonth(input)*1000).toISOString()).toBe("2026-02-28T12:00:00.000Z");
  });
  test("eine erratene Einspruchsreferenz erlaubt keinen Zugriff auf fremde Fälle",async()=>{
    const f=fixture(),other=f.s.reserve(BOB,"allgemein");
    const i={customId:"gor44:appeal:"+other.id,isChatInputCommand:()=>false,isModalSubmit:()=>true,fields:{getTextInputValue:()=>"x"}};
    await expect(f.features.handle(i,f.member(ALICE))).rejects.toThrow("eigenen Fall");expect(f.created).toHaveLength(0);
  });
  test("ein nicht mehr zuständiger Bearbeiter verliert die alte persönliche Kanalzuweisung",async()=>{
    const f=fixture(),c=f.s.reserve(ALICE,"allgemein");f.s.change(c.id,{status:"open",assignee_id:BOB,channel_id:"1900000000000000099"});let removed="";
    const guild:any={id:GUILD,members:{fetch:async()=>({id:BOB,pending:false})}};
    await reviewAssignedAccess(guild,f.s,APPLICATION,()=>false,async()=>({permissionOverwrites:{cache:new Collection(),delete:async(id:string)=>{removed=id;}}}));
    expect(removed).toBe(BOB);expect(f.s.get(c.id).assignee_id).toBeNull();expect(f.s.get(c.id).status).toBe("open");
  });
});

describe("4.4 Aufbewahrung und Wiederherstellung",()=>{
  test("historische geschlossene Fälle werden nicht rückwirkend automatisch zur Löschung eingeplant",()=>{
    const s=store(),c=s.reserve(ALICE,"allgemein",timestamp()-100*DAY);s.change(c.id,{status:"closed"});
    const state=new CommunityState(s.db,GUILD);expect(state.policy(c.id)?.state).toBe("unclassified");expect(state.canDelete(s.get(c.id))).toBe(false);
    state.classify(c.id);expect(state.policy(c.id)?.delete_after).toBeGreaterThan(timestamp()+29*DAY);
  });
  test("Abschluss, Frist und aktive Aufbewahrungsausnahme werden getrennt geprüft",()=>{
    const f=fixture(),at=timestamp(),c=f.s.reserve(ALICE,"allgemein",at-40*DAY);f.features.state.open(c);f.s.change(c.id,{status:"closed"});f.features.state.close(c.id,at-31*DAY);
    expect(f.features.state.canDelete(f.s.get(c.id),at)).toBe(true);f.features.state.hold(c.id,30,"rechtliche_sicherung",at);
    expect(f.features.state.canDelete(f.s.get(c.id),at)).toBe(false);f.features.state.hold(c.id,0,"rechtliche_sicherung",at);expect(f.features.state.canDelete(f.s.get(c.id),at)).toBe(true);
  });
  function deletionFixture() {
    const s=store(),state=new CommunityState(s.db,GUILD),c=s.reserve(ALICE,"allgemein",timestamp()-100*DAY);state.open(c);s.change(c.id,{status:"closed",channel_id:"1900000000000000020"});state.close(c.id,timestamp()-95*DAY);
    let present=true,count=0,lost=false;
    const channel:any={id:"1900000000000000020",guild:{id:GUILD},type:0,parentId:"1900000000000000030",name:"fall-0001",topic:"gor-case:"+c.id,lastMessageId:"1900000000000000040",permissionOverwrites:{cache:new Collection()},
      delete:async()=>{count++;present=false;if(lost)throw Object.assign(new Error("private-body"),{code:"ECONNRESET"});}};
    const guild={channels:{fetch:async()=>{if(!present)throw Object.assign(new Error("private-body"),{code:10003,status:404});return channel;}}};
    const retention=new Retention(s,state,async()=>channel);
    return {s,state,c,channel,guild,retention,count:()=>count,lost:()=>{lost=true;}};
  }
  test("eine geänderte Kanalvorschau wird abgewiesen und löscht nichts",async()=>{
    const f=deletionFixture(),d=await f.retention.prepare(f.guild,f.c.id,OWNER);f.channel.topic="changed";
    await expect(f.retention.apply(f.guild,d.id,OWNER)).rejects.toThrow("geändert");expect(f.count()).toBe(0);
  });
  test("verlorene DELETE-Antwort wird durch Lesen aufgelöst, ohne zweite Löschung",async()=>{
    const f=deletionFixture(),d=await f.retention.prepare(f.guild,f.c.id,OWNER);f.lost();
    await f.retention.apply(f.guild,d.id,OWNER);expect(f.count()).toBe(1);expect(f.state.policy(f.c.id)?.state).toBe("channel_deleted");
    await expect(f.retention.apply(f.guild,d.id,OWNER)).rejects.toThrow();expect(f.count()).toBe(1);
  });
  test("Metadaten und Rücksicherungsjournal verhindern das Wiedererscheinen gelöschter Fallbezüge",async()=>{
    const f=deletionFixture(),before=f.s.db.serialize(),d=await f.retention.prepare(f.guild,f.c.id,OWNER);
    await f.retention.apply(f.guild,d.id,OWNER);expect(f.retention.sweep()).toBe(1);expect(f.s.get(f.c.id).opener_id).toBe("removed");
    // Simulate restoration of the old content while keeping the separate erasure ledger on the volume.
    f.s.db.query("UPDATE cases SET opener_id=?,channel_id=? WHERE id=?").run(ALICE,f.channel.id,f.c.id);
    f.s.db.query("UPDATE case_policy_v44 SET state='unclassified',erased_at=NULL WHERE case_id=?").run(f.c.id);
    f.retention.ledger.replay();expect(f.s.get(f.c.id).opener_id).toBe("removed");expect(f.s.get(f.c.id).channel_id).toBeNull();
    expect(f.s.reserve(BOB,"allgemein").id).toBeGreaterThan(f.c.id);expect(before.byteLength).toBeGreaterThan(0);
  });
  test("ein beschädigtes Löschjournal wird nicht stillschweigend ignoriert",()=>{
    const f=fixture();writeFileSync(join(f.s.directory,"erasure-ledger.jsonl"),"broken\n");expect(()=>f.features.retention.ledger.replay()).toThrow("unvollständig");
  });
});

describe("4.4 Ideen, Finanzen und native Veranstaltungen",()=>{
  test("eine eigene Idee kann nicht selbst freigegeben werden und benötigt eine Begründung",()=>{
    const f=fixture(),id=f.features.state.createIdea(ALICE,"Gemeinsam spielen","Eine gemeinsame Spielrunde planen.");
    expect(()=>f.features.state.decideIdea(id,"geplant","Ja",ALICE)).toThrow("eigene");expect(()=>f.features.state.decideIdea(id,"abgelehnt","",BOB)).toThrow();
    f.features.state.decideIdea(id,"geplant","Betreuung ist bestätigt.",BOB);expect(f.features.state.ideas()[0].status).toBe("geplant");
  });
  test("auch vollständig escapte Vorschläge bleiben innerhalb von Discords Kartengrenzen",async()=>{
    const f=fixture();for(let n=0;n<5;n++){const id=f.features.state.createIdea("participant-"+n,"*".repeat(100),"*".repeat(1500));f.features.state.decideIdea(id,"geplant","*".repeat(500),OWNER);}
    await f.features.ideas(interaction("ideen"),f.member());expect(f.answers[0].embeds[0].description.length).toBeLessThanOrEqual(4096);
  });
  test("Finanzbericht trennt private Beiträge, rechnet in Cent und verhindert ungedeckte Rücklagen",()=>{
    const input={period:"2026-11",received:100,refunds:0,fees:3,costs:46.48,opening:0,reserve:20,personal:500,charity:10};
    const r=financeReport(input);expect(financeBalance(r)).toBe(4052);expect(r.personal).toBe(50000);
    expect(()=>financeReport({...input,reserve:50})).toThrow();expect(()=>financeReport({...input,fees:0.001})).toThrow();
  });
  test("Finanzvorschauen sind persönlich, zeitlich begrenzt und genau einmal publizierbar",()=>{
    const f=fixture(),report=financeReport({period:"2026-11",received:100,refunds:0,fees:0,costs:40,opening:0,reserve:0,personal:0,charity:0}),d=f.features.state.draft("finance",OWNER,report);
    expect(()=>f.features.state.publishFinance(d.id,BOB)).toThrow();f.features.state.publishFinance(d.id,OWNER);expect(()=>f.features.state.publishFinance(d.id,OWNER)).toThrow();
    expect((f.s.db.query("SELECT COUNT(*) AS n FROM finance_reports_v44").get() as any).n).toBe(1);
  });
  test("ein Veranstaltungsbeginn ohne Zeitzone oder in der Vergangenheit wird abgewiesen",()=>{
    const input={title:"Spielrunde",start:"2026-11-21T19:00",minutes:60,location:"Öffentliche Lobby",description:"Zusammen spielen"};
    expect(()=>eventDraft(input)).toThrow("Zeitzone");expect(()=>eventDraft({...input,start:"2020-01-01T19:00+01:00"})).toThrow();
  });
  test("verlorene Veranstaltungsanlage wird nicht automatisch wiederholt und lässt sich exakt zuordnen",async()=>{
    const f=fixture(),p=eventDraft({title:"Spielrunde",start:new Date(Date.now()+DAY*1000).toISOString(),minutes:60,location:"Community",description:"Zusammen spielen"});
    const d=f.features.state.draft("event",OWNER,p);let calls=0;
    const actual={...p,id:"1900000000000000011",creatorId:APPLICATION,scheduledStartTimestamp:p.scheduledStartTime,scheduledEndTimestamp:p.scheduledEndTime,url:"https://discord.com/events/x/y"};
    const guild={scheduledEvents:{create:async()=>{calls++;throw new Error("private-body");},fetch:async()=>actual}};
    await expect(publishEvent(f.features.state,guild,d.id,OWNER,APPLICATION)).rejects.toThrow("unklar");
    await expect(publishEvent(f.features.state,guild,d.id,OWNER,APPLICATION)).rejects.toThrow();expect(calls).toBe(1);
    await recoverEvent(f.features.state,guild,d.id,actual.id,APPLICATION);expect((f.s.db.query("SELECT state FROM drafts_v44 WHERE id=?").get(d.id) as any).state).toBe("done");
  });
  test("genau ein zusätzlicher Projektpilot benötigt bestätigte Absprachen und Budget",()=>{
    const f=fixture(),a=f.s.reserve(ALICE,"projekt"),b=f.s.reserve(BOB,"projekt");f.s.change(a.id,{status:"open"});f.s.change(b.id,{status:"open"});
    f.features.state.projectCheck(a.id,ALICE,5000,"https://example.org/vereinbarung",OWNER);f.s.setProjectPhase(a.id,"pruefung",OWNER);f.s.setProjectPhase(a.id,"gespraech",OWNER);f.s.setProjectPhase(a.id,"pilot",OWNER);
    expect(()=>f.features.state.projectCheck(b.id,BOB,0,"https://example.org/zweiter",OWNER)).toThrow("bereits");expect(f.features.state.projectReady(a.id)?.budget).toBe(5000);
  });
});

describe("4.4 Vorschau, geschützte Gestaltung und verschlüsselte Sicherung",()=>{
  test("die Vorschau ist lesend und erkennt spätere Kanal-, Rechte- und Inhaltsänderungen",async()=>{
    const f=fixture(),ctx={guild:f.guild as unknown as Guild,application:APPLICATION,target:GUILD,maps:f.guild.maps(),storage:f.s};await new AutoSetup(ctx).run();
    // The adapter uses plain objects; real Discord rules expose toJSON().
    for(const rule of f.guild.ruleRows.values())rule.toJSON=()=>({id:rule.id,name:rule.name,enabled:rule.enabled});
    f.guild.calls=[];const before=await captureChangePlan(ctx.guild,ctx.maps,f.s,APPLICATION,VERSION);expect(f.guild.calls).toEqual([]);
    const channel=f.guild.channelRows.get(ctx.maps.channels.lounge);channel.topic="manuell geändert";
    const after=await captureChangePlan(ctx.guild,ctx.maps,f.s,APPLICATION,VERSION);expect(after.fingerprint).not.toBe(before.fingerprint);
    expect(after.configuration).toBe(before.configuration);
  });
  test("eine geschützte Gestaltung bleibt erhalten, Sicherheitsrechte werden weiter repariert",async()=>{
    const f=fixture(),ctx={guild:f.guild as unknown as Guild,application:APPLICATION,target:GUILD,maps:f.guild.maps(),storage:f.s};await new AutoSetup(ctx).run();
    const channel=f.guild.channelRows.get(ctx.maps.channels.lounge);channel.name="eigene-lounge";setProtection(f.s,"channel:lounge:name",24);
    channel.permissionOverwrites.cache.clear();const report=await new AutoSetup(ctx).run();expect(report.issues).toEqual([]);expect(channel.name).toBe("eigene-lounge");expect(channel.permissionOverwrites.cache.size).toBeGreaterThan(0);
    expect(()=>setProtection(f.s,"channel:lounge:permissions",24)).toThrow();setProtection(f.s,"channel:lounge:name",0);await new AutoSetup(ctx).run();expect(channel.name).toBe("lounge");
  });
  test("GCM erkennt falsche Schlüssel und manipulierte verschlüsselte Sicherungen",()=>{
    const key=Buffer.alloc(32,7),plain=Buffer.from("sensible SQLite-Daten"),encrypted=encryptBackup(plain,key);
    expect(encrypted.includes(plain)).toBe(false);expect(decryptBackup(encrypted,key)).toEqual(plain);
    const altered=Buffer.from(encrypted);altered[altered.length-1]^=1;expect(()=>decryptBackup(altered,key)).toThrow("Integritätsprüfung");expect(()=>decryptBackup(encrypted,Buffer.alloc(32,8))).toThrow();
    expect(()=>backupKey("invalid")).toThrow();
  });
  test("ohne eingerichtetes externes Ziel werden keine Daten übertragen",async()=>{
    const f=fixture(),remote=new RemoteBackup(f.s,GUILD,{},()=>({entries:[]}));await remote.run(true);expect(remote.state).toBe("not_configured");expect(f.s.setting("backup_remote_at_v44")).toBeUndefined();
  });
  test("externe Sicherung wird verschlüsselt zurückgelesen und erst danach bestätigt",async()=>{
    const f=fixture(),objects=new Map<string,Buffer>(),key=Buffer.alloc(32,9);
    const bucket={file:(name:string)=>({write:async(data:Uint8Array)=>{objects.set(name,Buffer.from(data));},arrayBuffer:async()=>Uint8Array.from(objects.get(name)!).buffer,delete:async()=>{objects.delete(name);}})};
    const remote=new RemoteBackup(f.s,GUILD,{GOR_BACKUP_KEY:key.toString("base64")},()=>f.features.retention.ledger.export(),bucket);
    await remote.run(true);expect(remote.state).toBe("verified");expect(objects.size).toBe(2);expect(f.s.setting("backup_remote_at_v44")).toBeString();
    const snapshot=[...objects.entries()].find(([name])=>name.includes("snapshot-"))!;
    const restored=JSON.parse(decryptBackup(snapshot[1],key).toString());expect(restored.guild).toBe(GUILD);expect(Buffer.from(restored.database,"base64").subarray(0,15).toString()).toBe("SQLite format 3");
  });
  test("eine unbestätigte externe Kopie wird nicht als gesichert ausgegeben",async()=>{
    const f=fixture(),bucket={file:()=>({write:async()=>{},arrayBuffer:async()=>new ArrayBuffer(4),delete:async()=>{}})};
    const remote=new RemoteBackup(f.s,GUILD,{GOR_BACKUP_KEY:Buffer.alloc(32,3).toString("base64")},()=>({entries:[]}),bucket);
    await remote.run(true);expect(remote.state).toBe("attention");expect(f.s.setting("backup_remote_at_v44")).toBeUndefined();
  });
  test("echte verschlüsselte SQLite-Rücksicherung wendet das aktuelle getrennte Löschjournal erneut an",()=>{
    const f=fixture(),c=f.s.reserve(ALICE,"allgemein"),at=timestamp(),key=Buffer.alloc(32,5);f.features.state.open(c);
    const old=encryptBackup(Buffer.from(JSON.stringify({format:1,guild:GUILD,created:at,database:Buffer.from(f.s.db.serialize()).toString("base64"),ledger:{highwater:c.id,entries:[]}})),key);
    const current=encryptBackup(Buffer.from(JSON.stringify({format:1,highwater:c.id+100,entries:[{case_id:c.id,at}]})),key);
    const restored=restoreSnapshot(old,current,key,GUILD,at),db=Database.deserialize(restored.database,{readonly:false,strict:true});
    try{expect((db.query("SELECT opener_id FROM cases WHERE id=?").get(c.id) as any).opener_id).toBe("removed");
      expect((db.query("SELECT value FROM settings WHERE key='case_id_highwater'").get() as any).value).toBe(String(c.id+100));expect(restored.erased).toBe(1);}finally{db.close();}
    expect(()=>restoreSnapshot(old,current,key,"other",at)).toThrow("Zielserver");expect(()=>restoreSnapshot(old,current,key,GUILD,at+31*DAY)).toThrow("30-Tage");
  });
});

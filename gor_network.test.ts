import { describe, test, expect, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readdirSync, copyFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { storageLocation } from "./storage_path";
import { ApplicationCommand, Client } from "discord.js";
import { Store, GUILD, APPLICATION, ROLES, eligible, roleKeys, mayClose, privacyCheck,
  UserError, validateIdentity, commandDefinitions, healthResponse, sameAnnouncement, announcementEmbed, commandShape,
  readToken, runtimeSettings, requireStorage, errorDiagnostic } from "./gor_network";

const locations: string[] = [], stores: Store[] = [];
function location() { const p = mkdtempSync(join(tmpdir(), "gor-bot-")); locations.push(p); return p; }
function store(dir = location()) { const db = new Store(dir); stores.push(db); return db; }
afterEach(() => { for (const s of stores.splice(0)) try { s.close(); } catch {} for (const d of locations.splice(0)) rmSync(d, { recursive: true, force: true }); });

describe("Fallbetrieb und Wiederaufnahme", () => {
  test("mehrere Datenbankverbindungen verhindern doppelte offene Fälle", () => {
    const dir = location(), a = store(dir), b = store(dir);
    a.reserve("alice", "technik", 1000);
    expect(() => b.reserve("alice", "technik", 1100)).toThrow(UserError);
    expect(a.queue()).toHaveLength(1);
  });
  test("Neustart markiert eine unterbrochene Kanalanlage zur Prüfung", () => {
    const dir = location(), a = store(dir), c = a.reserve("alice", "allgemein", 1000);
    const b = store(dir); expect(b.get(c.id).status).toBe("needs_review");
    expect(() => b.reserve("alice", "allgemein", 1100)).toThrow();
  });
  test("unterbrochene Rechteänderungen werden nicht als bestätigt übernommen", () => {
    const dir = location(), a = store(dir), c = a.reserve("alice", "zahlung", 1000);
    a.change(c.id, { channel_id: "123", assignee_id: "finanz", status: "assigning" });
    const b = store(dir); expect(b.get(c.id)).toMatchObject({ status: "needs_review", assignee_id: "finanz", channel_id: "123" });
  });
  test("offene bestätigte Fälle und Zuordnungen überstehen den Neustart", () => {
    const dir = location(), a = store(dir), c = a.reserve("alice", "projekt", 1000);
    a.change(c.id, { status: "open", channel_id: "321" }); a.setting("panel_message_id", "456");
    const b = store(dir); expect(b.get(c.id).status).toBe("open"); expect(b.setting("panel_message_id")).toBe("456");
  });
  test("Anfrager haben eine Minute Abstand und höchstens drei offene Fälle", () => {
    const s = store(); s.reserve("alice", "allgemein", 1000);
    expect(() => s.reserve("alice", "technik", 1059)).toThrow(); s.reserve("alice", "technik", 1060); s.reserve("alice", "beschwerde", 1120);
    expect(() => s.reserve("alice", "projekt", 1180)).toThrow(); expect(s.queue()).toHaveLength(3);
  });
  test("neue Anfragen nach einem abgeschlossenen Fall behalten unterschiedliche IDs", () => {
    const s = store(), a = s.reserve("alice", "technik", 1000); s.change(a.id, { status: "closed" });
    const b = s.reserve("alice", "technik", 1100); expect(b.id).toBeGreaterThan(a.id); expect(s.get(a.id).status).toBe("closed");
  });
  test("SQL-Nutzdaten können keine Spalten oder Tabellen verändern", () => {
    const s = store(), c = s.reserve("x'); DROP TABLE cases;--", "technik", 1000);
    expect(s.get(c.id).opener_id).toContain("DROP TABLE");
    expect(() => s.change(c.id, { "status='closed'; DROP TABLE cases;--": "x" } as any)).toThrow(); expect(s.health()).toBe(true);
  });
});

describe("Zuständigkeiten und Zugriffe", () => {
  test("Zahlungsfälle bleiben Finanzzuständigkeit oder Inhaber vorbehalten", () => {
    expect(eligible("zahlung", "moderator", [ROLES.moderation], "owner")).toBe(false);
    expect(eligible("zahlung", "finanz", [ROLES.finanzen], "owner")).toBe(true);
    expect(eligible("zahlung", "owner", [], "owner")).toBe(true);
  });
  test("Techniker erhalten keine Beschwerde- oder Projektzuständigkeit", () => {
    expect(eligible("technik", "a", [ROLES.technik], "o")).toBe(true);
    expect(eligible("beschwerde", "a", [ROLES.technik], "o")).toBe(false);
    expect(eligible("projekt", "a", [ROLES.technik], "o")).toBe(false);
    expect(eligible("constructor", "o", [], "o")).toBe(false);
  });
  test("Selbstwahl lehnt Teamrollen, unbekannte und doppelte Rollen ab", () => {
    expect(roleKeys([])).toEqual([]); expect(roleKeys(["cw-spieler", "ping-events"])).toHaveLength(2);
    for (const values of [["networkleitung"], ["__proto__"], ["constructor"], ["ping-cw", "ping-cw"]]) expect(() => roleKeys(values)).toThrow();
  });
  test("nur Anfragender, Bearbeiter und Inhaber dürfen einen Fall schließen", () => {
    const c = store().reserve("alice", "allgemein", 1000); c.assignee_id = "bob";
    expect(mayClose(c, "alice", "owner")).toBe(true); expect(mayClose(c, "bob", "owner")).toBe(true);
    expect(mayClose(c, "owner", "owner")).toBe(true); expect(mayClose(c, "other", "owner")).toBe(false);
  });
  test("öffentliche oder fremde Fallkanalzugriffe blockieren weitere Verarbeitung", () => {
    const c = store().reserve("alice", "allgemein", 1000), view = 1024n;
    const valid = [{ id: GUILD, type: 0, allow: 0n, deny: view }, { id: "alice", type: 1, allow: view, deny: 0n }, { id: APPLICATION, type: 1, allow: view, deny: 0n }];
    expect(() => privacyCheck(valid, c, APPLICATION)).not.toThrow();
    expect(() => privacyCheck(valid.slice(1), c, APPLICATION)).toThrow();
    expect(() => privacyCheck([...valid, { id: "staffrole", type: 0, allow: view, deny: 0n }], c, APPLICATION)).toThrow();
    expect(() => privacyCheck([...valid, { id: "other", type: 1, allow: view, deny: 0n }], c, APPLICATION)).toThrow();
  });
  test("eine falsche Anwendung wird abgewiesen, bestehendes Administratorrecht beendet keine Verbindung", () => {
    expect(() => validateIdentity(APPLICATION, APPLICATION, GUILD, false)).not.toThrow();
    expect(() => validateIdentity(APPLICATION, APPLICATION, GUILD, true)).not.toThrow();
    for (const args of [["wrong", APPLICATION, GUILD, false], [APPLICATION, "wrong", GUILD, false], [APPLICATION, APPLICATION, "wrong", false]])
      expect(() => validateIdentity(...args as [string, string, string, boolean])).toThrow();
  });
});

describe("Railway-Startkonfiguration", () => {
  test("relative und zitierte Speicherpfade verwenden das Arbeitsverzeichnis des Bots", () => {
    for (const [configured, expected] of [["data", "/app/data"], ["./betrieb", "/app/betrieb"],
      [' "./gor data/" ', "/app/gor data"], ['"/gor-storage/"', "/gor-storage"], ["../gor-storage", "/gor-storage"]])
      expect(storageLocation({ GOR_DATA_DIR: configured }, "/app").directory).toBe(expected);
    expect(storageLocation({}, "/app", "/data").directory).toBe("/data");
  });
  test("auch ein relatives Volume hat Vorrang und wird vor beiden Startphasen gleich aufgelöst", () => {
    expect(storageLocation({ RAILWAY_VOLUME_MOUNT_PATH: '"./volume"', GOR_DATA_DIR: "/stale" }, "/app"))
      .toEqual({ directory: "/app/volume", hasVolume: true });
    expect(storageLocation({ RAILWAY_VOLUME_MOUNT_PATH: "''", GOR_DATA_DIR: "data" }, "/app"))
      .toEqual({ directory: "/app/data", hasVolume: false });
    expect(runtimeSettings({ RAILWAY_ENVIRONMENT_ID: "fixture", RAILWAY_VOLUME_MOUNT_PATH: '"./volume"', GOR_DATA_DIR: "/stale" }))
      .toMatchObject({ directory: join(process.cwd(), "volume"), storage: "persistent" });
  });
  test("übliche Tokenvariablen werden ohne Namensabhängigkeit erkannt", () => {
    for (const key of ["GOR_DISCORD_BOT_TOKEN", "DISCORD_TOKEN", "DISCORD_BOT_TOKEN", "BOT_TOKEN", "TOKEN"] as const)
      expect(readToken({ [key]: "fixture-token" })).toEqual({ key, value: "fixture-token" });
  });
  test("der vorhandene GoR-Token hat Vorrang; leere Platzhalter blockieren keinen Alias", () => {
    expect(readToken({ GOR_DISCORD_BOT_TOKEN: "primary", DISCORD_TOKEN: "other" })?.value).toBe("primary");
    expect(readToken({ GOR_DISCORD_BOT_TOKEN: "   ", DISCORD_TOKEN: "alias" })?.value).toBe("alias");
    expect(readToken({})).toBeNull();
  });
  test("ein versehentlicher Bot-Präfix und äußere Anführungszeichen werden entfernt", () => {
    expect(readToken({ TOKEN: ' "Bot fixture-token" ' })?.value).toBe("fixture-token");
  });
  test("Railway ohne Volume bleibt startfähig, pausiert aber dauerhafte Fälle", () => {
    const config = runtimeSettings({ RAILWAY_ENVIRONMENT_ID: "fixture", GOR_DATA_DIR: "/data" });
    expect(config).toMatchObject({ storage: "temporary", directory: "/data", supportEnabled: false });
    expect(() => requireStorage(config, "status")).not.toThrow();
    expect(() => requireStorage(config, "rollen")).not.toThrow();
    expect(() => requireStorage(config, "gor:roles:v4")).not.toThrow();
    for (const action of ["support", "projektanfrage", "supportpanel", "gor:case:allgemein", "ankuendigung", "gor:publish:fixture", "backup", "faelle"])
      expect(() => requireStorage(config, action)).toThrow(UserError);
  });
  test("das tatsächliche Railway-Volume hat Vorrang vor einem veralteten Datenpfad", () => {
    expect(runtimeSettings({ RAILWAY_ENVIRONMENT_ID: "fixture", RAILWAY_VOLUME_MOUNT_PATH: "/app/data", GOR_DATA_DIR: "/data" }))
      .toMatchObject({ storage: "persistent", directory: "/app/data", supportEnabled: true });
  });
  test("Support kann auf einem persistenten Dienst ausdrücklich pausiert werden", () => {
    for (const value of ["false", "FALSE", "0", "off", "no"])
      expect(runtimeSettings({ RAILWAY_VOLUME_MOUNT_PATH: "/data", GOR_SUPPORT_ENABLED: value }).supportEnabled).toBe(false);
  });
  test("Startdiagnosen enthalten keine fremden Fehlermeldungen oder Zugangsdaten", () => {
    const raw = { code: 50013, message: "fixture-secret", requestBody: { token: "fixture-secret" } };
    expect(errorDiagnostic(raw).code).toBe("permissions_missing");
    expect(JSON.stringify(errorDiagnostic(raw))).not.toContain("fixture-secret");
    expect(JSON.stringify(errorDiagnostic({ message: "fixture-secret" }))).not.toContain("fixture-secret");
    expect(errorDiagnostic({ status: 401 }).code).toBe("token_invalid");
    expect(errorDiagnostic({ code: "startup_timeout" }).code).toBe("startup_timeout");
    expect(errorDiagnostic({ code: "EACCES", path: "fixture-secret" }).code).toBe("storage_permissions");
    expect(JSON.stringify(errorDiagnostic({ code: "SQLITE_CANTOPEN", path: "fixture-secret" }))).not.toContain("fixture-secret");
  });
});

describe("Veröffentlichungen ohne Doppelversand", () => {
  test("Doppelklick und ein fremder Bestätiger können keinen weiteren Versand starten", () => {
    const s = store(), d = s.draft("alice", "neuigkeiten", "GoR", "Neues vom Projekt", 1000);
    expect(() => s.startSend(d.id, "other", 1010)).toThrow();
    expect(s.startSend(d.id, "alice", 1010).state).toBe("sending");
    expect(() => s.startSend(d.id, "alice", 1011)).toThrow();
  });
  test("nach Absturz wird unklarer Versand zur Prüfung blockiert", () => {
    const dir = location(), a = store(dir), d = a.draft("alice", "termine", "Training", "Samstag um 17 Uhr", 1000);
    a.startSend(d.id, "alice", 1001); const b = store(dir);
    expect(b.operation(d.id).state).toBe("needs_review"); expect(() => b.startSend(d.id, "alice", 1002)).toThrow();
  });
  test("abgelaufene oder verworfene Vorschauen können nicht mehr senden", () => {
    const s = store(), a = s.draft("alice", "termine", "Event", "Kommt dazu", 1000), b = s.draft("alice", "neuigkeiten", "News", "Text", 1000);
    expect(() => s.startSend(a.id, "alice", 1900)).toThrow(); s.cancel(b.id, "alice");
    expect(() => s.startSend(b.id, "alice", 1001)).toThrow(); expect(s.operation(b.id).payload).toBe("{}");
  });
  test("Rückprüfung verlangt Bot-Autor und vollständigen passenden Inhalt", () => {
    const op = store().draft("alice", "neuigkeiten", "Titel", "Text");
    const good = { author: { id: APPLICATION }, content: "", embeds: [announcementEmbed(op)] };
    expect(sameAnnouncement(op, good)).toBe(true);
    expect(sameAnnouncement(op, { ...good, author: { id: "other" } })).toBe(false);
    expect(sameAnnouncement(op, { ...good, embeds: [{ ...good.embeds[0], description: "anderer Text" }] })).toBe(false);
    expect(sameAnnouncement(op, { ...good, embeds: [{ ...good.embeds[0], image: { url: "https://example.com/x" } }] })).toBe(false);
    expect(sameAnnouncement(op, { ...good, content: "@everyone" })).toBe(false);
  });
  test("alte Interaktionskennungen verhindern doppeltes Verarbeiten", () => {
    const s = store(); expect(s.consume("interaction-one")).toBe(true); expect(s.consume("interaction-one")).toBe(false);
  });
});

describe("Dauerbetrieb und Sicherungen", () => {
  test("ein konsistentes Backup lässt sich mit aktiver WAL-Datenbank wiederherstellen", () => {
    const s = store(), c = s.reserve("alice", "technik", 1000); s.change(c.id, { channel_id: "abc", status: "open" });
    const file = s.backup(true)!; const target = location(); copyFileSync(join(s.directory, "backups", file), join(target, "support.sqlite"));
    const restored = store(target); expect(restored.get(c.id)).toMatchObject({ opener_id: "alice", channel_id: "abc", status: "open" }); expect(restored.health()).toBe(true);
  });
  test("zusätzliche unveränderliche Datenbankdateien enthalten keine Falltexte", () => {
    const s = store(); s.reserve("alice", "allgemein", 1000);
    const columns = (s.db.query("PRAGMA table_info(cases)").all() as any[]).map(c => c.name);
    expect(columns).not.toContain("details"); expect(columns).not.toContain("summary"); expect(columns).not.toContain("token");
  });
  test("wiederholte Wartung erzeugt nicht bei jeder Anfrage eine Sicherung", () => {
    const s = store(); expect(s.backup()).toBeString(); expect(s.backup()).toBeNull(); expect(readdirSync(join(s.directory, "backups"))).toHaveLength(1);
  });
  test("Gesundheitsprüfung unterscheidet Prozess, Discord-Bereitschaft und Datenbankfehler", async () => {
    expect(healthResponse("/live", false, true, "token_missing").status).toBe(200);
    const pending = healthResponse("/health", false, true, "token_missing"); expect(pending.status).toBe(503);
    expect(await pending.json()).toMatchObject({ status: "token_missing" });
    expect(healthResponse("/health", true, false, "starting").status).toBe(503);
    expect(healthResponse("/ready", true, true, "ready").status).toBe(200);
    expect(healthResponse("/support.sqlite", true, true, "ready").status).toBe(404);
  });
  test("Befehlsschemata bleiben bei Discords camelCase-Darstellung vergleichbar", () => {
    const a = { name: "test", description: "Test", options: [{ type: 4, name: "fall", description: "Fall", required: true, min_value: 1 }] };
    const b = { name: "test", description: "Test", options: [{ type: 4, name: "fall", description: "Fall", required: true, minValue: 1 }] };
    expect(commandShape(a)).toBe(commandShape(b)); b.options[0].minValue = 2; expect(commandShape(a)).not.toBe(commandShape(b));
  });
  test("der echte Discord-Adapter kann alle registrierten Befehlsschemata bestätigen", () => {
    const client = new Client({ intents: [] });
    for (const definition of commandDefinitions()) {
      const command = Reflect.construct(ApplicationCommand, [client, { ...definition, id: "123", application_id: APPLICATION, guild_id: GUILD, version: "1", type: 1 }]);
      expect(commandShape(command.toJSON())).toBe(commandShape(definition));
    }
    void client.destroy();
  });
  test("29 vollständige Befehle sind eindeutig und innerhalb von Discords Grenzen", () => {
    const defs = commandDefinitions(); expect(defs).toHaveLength(29); expect(new Set(defs.map(d => d.name)).size).toBe(29);
    for (const d of defs) { expect(d.name.length).toBeLessThanOrEqual(32); expect(d.description.length).toBeLessThanOrEqual(100); expect(d.description.length).toBeGreaterThan(0); }
  });
  test("die einzelne Datei lässt sich auch als Railway-TSX parsen", () => {
    const source = readFileSync(new URL("./gor_network.ts", import.meta.url), "utf8");
    expect(() => new Bun.Transpiler({ loader: "tsx", target: "bun" }).transformSync(source)).not.toThrow();
    expect(Buffer.byteLength(source)).toBeLessThan(96 * 1024);
  });
});

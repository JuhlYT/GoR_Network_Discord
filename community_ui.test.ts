import { afterEach, describe, expect, test } from "bun:test";
import { ActionRow, Embed } from "discord.js";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store, APPLICATION, GUILD, CHANNELS, caseModal, commandDefinitions, requireStorage, runtimeSettings } from "./gor_network";
import { communityHub, guideView, faqView, GUIDE_TOPICS, FAQ_TOPICS, PROJECT_PHASES, sameCommunityPanel,
  canAdvanceProject, pageWindow } from "./community_ui";

const directories: string[] = [], stores: Store[] = [];
function directory() { const path = mkdtempSync(join(tmpdir(), "gor-community-")); directories.push(path); return path; }
function store(path = directory()) { const db = new Store(path); stores.push(db); return db; }
afterEach(() => { for (const s of stores.splice(0)) try { s.close(); } catch {} for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true }); });

describe("Community-Menü und persönlicher Einstieg", () => {
  test("alle Karten und Schaltflächen passen in Discords tatsächliche Grenzen", () => {
    const views = [...GUIDE_TOPICS.map(topic => guideView(topic, CHANNELS)), ...Object.keys(FAQ_TOPICS).map(topic => faqView(topic, CHANNELS))];
    for (const view of views) {
      expect(view.components.length).toBeLessThanOrEqual(5);
      const ids = view.components.flatMap(row => row.components.map(button => "custom_id" in button ? button.custom_id : undefined));
      expect(new Set(ids).size).toBe(ids.length);
      for (const row of view.components) {
        expect(row.components.length).toBeLessThanOrEqual(5);
        for (const button of row.components) {
          if (!("custom_id" in button) || !("label" in button)) throw new Error("Expected a normal navigation button");
          expect(button.custom_id.length).toBeLessThanOrEqual(100); expect(button.label!.length).toBeLessThanOrEqual(80);
        }
      }
      let characters = 0;
      for (const e of view.embeds) {
        expect(e.title!.length).toBeLessThanOrEqual(256); expect(e.description!.length).toBeLessThanOrEqual(4096);
        characters += (e.title?.length || 0) + (e.description?.length || 0) + (e.footer?.text.length || 0);
        for (const field of e.fields || []) {
          expect(field.name.length).toBeLessThanOrEqual(256); expect(field.value.length).toBeLessThanOrEqual(1024);
          characters += field.name.length + field.value.length;
        }
      }
      expect(characters).toBeLessThanOrEqual(6000);
    }
  });
  test("die Menüprüfung akzeptiert den echten Discord-Adapter und erkennt fremde oder veränderte Inhalte", () => {
    const expected = communityHub(CHANNELS);
    const actual = { content: "", author: { id: APPLICATION }, embeds: expected.embeds.map(e => Reflect.construct(Embed, [e])),
      components: expected.components.map(row => Reflect.construct(ActionRow, [row])) };
    expect(sameCommunityPanel(actual, expected, APPLICATION)).toBe(true);
    expect(sameCommunityPanel({ ...actual, author: { id: "other" } }, expected, APPLICATION)).toBe(false);
    expect(sameCommunityPanel({ ...actual, content: "Zusätzlicher Inhalt" }, expected, APPLICATION)).toBe(false);
    const tampered = JSON.parse(JSON.stringify(expected)); tampered.components[0].components[0].custom_id = "foreign:action";
    expect(sameCommunityPanel({ ...tampered, author: { id: APPLICATION } }, expected, APPLICATION)).toBe(false);
    const image = { ...expected, embeds: [{ ...expected.embeds[0], image: { url: "https://example.com/extra.png" } }], author: { id: APPLICATION } };
    expect(sameCommunityPanel(image, expected, APPLICATION)).toBe(false);
  });
  test("Orientierung funktioniert auch ohne Volume; private Fallfunktionen bleiben gesperrt", () => {
    const settings = runtimeSettings({ RAILWAY_ENVIRONMENT_ID: "fixture" });
    for (const name of ["start", "faq", "gor:roles:open:v5", ...GUIDE_TOPICS.map(topic => "gor:guide:v5:" + topic)])
      expect(() => requireStorage(settings, name)).not.toThrow();
    for (const name of ["meine_faelle", "team", "projektstatus", "communitypanel", "gor:own:v5", "gor:queue:v5:1"])
      expect(() => requireStorage(settings, name)).toThrow();
  });
  test("Fallseiten verlieren keine Einträge und behandeln veraltete Seiten nach Abschluss korrekt", () => {
    const cases = Array.from({ length: 19 }, (_, id) => id);
    const pages = [1, 2, 3].map(page => pageWindow(cases, page));
    expect(pages.flatMap(page => page.items)).toEqual(cases);
    expect(pageWindow([1], 3)).toMatchObject({ page: 1, pages: 1, items: [1] });
    expect(pageWindow([], 999)).toMatchObject({ page: 1, pages: 1, items: [] });
    expect(pageWindow(cases, Number.NaN).page).toBe(1);
  });
  test("die neue Projektaufnahme erfasst fünf klare Angaben und ihre Slash-Einstiege sind registriert", () => {
    const modal = caseModal("projekt").toJSON();
    expect(modal.custom_id).toBe("gor:project:v5"); expect(modal.components).toHaveLength(5);
    const inputs = modal.components.flatMap(row => "components" in row ? row.components : []) as any[];
    expect(inputs.map(input => input.custom_id)).toEqual(["project", "game", "scale", "proposal", "contact"]);
    expect(inputs.filter(input => input.required)).toHaveLength(4);
    for (const input of inputs) { expect(input.label.length).toBeLessThanOrEqual(45); expect(input.placeholder.length).toBeLessThanOrEqual(100); }
    const names = commandDefinitions().map(command => command.name);
    for (const name of ["start", "faq", "meine_faelle", "team", "projektstatus", "communitypanel", "communitypanel_zuordnen"]) expect(names).toContain(name);
  });
});

describe("Dauerhafte und private Projektbetreuung", () => {
  test("bestehende Datenbanken werden ohne Verlust von Fällen oder Einstellungen erweitert", () => {
    const path = directory(), old = new Database(join(path, "support.sqlite"));
    old.exec("CREATE TABLE cases(id INTEGER PRIMARY KEY,guild_id TEXT,opener_id TEXT,kind TEXT,channel_id TEXT,assignee_id TEXT,status TEXT,created REAL,updated REAL); CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL)");
    old.query("INSERT INTO cases VALUES (1,?,'alice','projekt','123',NULL,'open',1000,1000)").run(GUILD);
    old.query("INSERT INTO settings VALUES ('panel_message_id','existing')").run(); old.close();
    const s = store(path); expect(s.get(1).channel_id).toBe("123"); expect(s.setting("panel_message_id")).toBe("existing"); expect(s.projectPhase(1)).toBe("neu");
  });
  test("Projektentscheidungen folgen dem vereinbarten Ablauf und überstehen den Neustart", () => {
    const path = directory(), a = store(path), c = a.reserve("alice", "projekt", 1000); a.change(c.id, { status: "open" });
    for (const phase of ["pruefung", "gespraech", "pilot", "aufgenommen"] as const) expect(a.setProjectPhase(c.id, phase, "reviewer")).toBe(phase);
    const b = store(path); expect(b.projectPhase(c.id)).toBe("aufgenommen");
    expect(b.db.query("SELECT outcome FROM audit WHERE action='project_phase' ORDER BY id DESC LIMIT 1").get()).toEqual({ outcome: "aufgenommen" });
    expect(canAdvanceProject("neu", "aufgenommen")).toBe(false);
    expect(canAdvanceProject("abgelehnt", "pruefung")).toBe(true);
    expect(Object.keys(PROJECT_PHASES)).toHaveLength(6);
  });
  test("eigene, geschlossene und ungeklärte Projektfälle können nicht freigegeben werden", () => {
    const s = store(), c = s.reserve("alice", "projekt", 1000); s.change(c.id, { status: "open" });
    expect(() => s.setProjectPhase(c.id, "pruefung", "alice")).toThrow();
    expect(() => s.setProjectPhase(c.id, "aufgenommen", "reviewer")).toThrow();
    expect(() => s.setProjectPhase(c.id, "constructor", "reviewer")).toThrow();
    expect(s.projectPhase(c.id)).toBe("neu");
    s.change(c.id, { status: "needs_review" }); expect(() => s.setProjectPhase(c.id, "pruefung", "reviewer")).toThrow();
    s.change(c.id, { status: "closed" }); expect(() => s.setProjectPhase(c.id, "pruefung", "reviewer")).toThrow();
    const general = s.reserve("bob", "allgemein", 1100); s.change(general.id, { status: "open" });
    expect(() => s.setProjectPhase(general.id, "pruefung", "reviewer")).toThrow();
  });
  test("ein doppelter Phasenwechsel erzeugt keinen zweiten Entscheidungsstand", () => {
    const s = store(), c = s.reserve("alice", "projekt", 1000); s.change(c.id, { status: "open" });
    s.setProjectPhase(c.id, "pruefung", "reviewer");
    expect(() => s.setProjectPhase(c.id, "pruefung", "reviewer")).toThrow();
    expect(s.db.query("SELECT count(*) AS n FROM audit WHERE action='project_phase'").get()).toEqual({ n: 1 });
  });
  test("die persönliche Übersicht zeigt nur eigene Anfragen dieses Servers", () => {
    const s = store();
    for (let n = 0; n < 12; n++) { const c = s.reserve("alice", "allgemein", 1000 + n * 60); s.change(c.id, { status: "closed" }); }
    s.reserve("bob", "zahlung", 3000);
    s.db.query("INSERT INTO cases(guild_id,opener_id,kind,status,created,updated) VALUES ('foreign','alice','zahlung','open',4000,4000)").run();
    const rows = s.memberCases("alice"); expect(rows).toHaveLength(10);
    expect(rows.every(c => c.opener_id === "alice" && c.guild_id === GUILD)).toBe(true);
    expect(rows.map(c => c.id)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
  });
});

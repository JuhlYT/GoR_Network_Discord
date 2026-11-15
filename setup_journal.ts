import type { Database } from "bun:sqlite";

export type ManagedResource = { key: string; id: string | null; marker: string | null; state: string; started: number; error: string | null };
export class SetupJournal {
  constructor(readonly db: Database) {
    db.exec(`CREATE TABLE IF NOT EXISTS managed_resources(key TEXT PRIMARY KEY,id TEXT,marker TEXT,state TEXT NOT NULL,started REAL NOT NULL,error TEXT);
      CREATE TABLE IF NOT EXISTS setup_lease(id INTEGER PRIMARY KEY CHECK(id=1),owner TEXT NOT NULL,expires REAL NOT NULL);
      CREATE TABLE IF NOT EXISTS setup_snapshots(id INTEGER PRIMARY KEY,resource TEXT NOT NULL,at REAL NOT NULL,payload TEXT NOT NULL);`);
  }
  get(key: string) { return this.db.query("SELECT * FROM managed_resources WHERE key=?").get(key) as ManagedResource | null; }
  bind(key: string, id: string) {
    this.db.query("INSERT INTO managed_resources VALUES (?,?,NULL,'active',?,NULL) ON CONFLICT(key) DO UPDATE SET id=excluded.id,marker=NULL,state='active',error=NULL")
      .run(key, id, Date.now());
  }
  begin(key: string) {
    return this.db.transaction(() => {
      const existing = this.get(key);
      if (existing?.state === "creating" || existing?.state === "review") return { record: existing, fresh: false };
      const marker = "gor-init-" + crypto.randomUUID().replaceAll("-", "").slice(0, 24);
      this.db.query("INSERT INTO managed_resources VALUES (?,NULL,?,'creating',?,NULL) ON CONFLICT(key) DO UPDATE SET id=NULL,marker=excluded.marker,state='creating',started=excluded.started,error=NULL")
        .run(key, marker, Date.now());
      return { record: this.get(key)!, fresh: true };
    }).immediate();
  }
  fail(key: string, code: string, definitive = false) {
    // A definitive API rejection cannot have created a resource. Ambiguous requests retain their marker.
    this.db.query("UPDATE managed_resources SET error=?,state=CASE WHEN state='creating' AND ?=1 THEN 'rejected' ELSE state END WHERE key=?")
      .run(code, definitive ? 1 : 0, key);
  }
  clearAbsent(key: string) {
    const record = this.get(key);
    if (!record || !["creating", "review"].includes(record.state)) throw new Error("No uncertain creation");
    this.db.query("UPDATE managed_resources SET state='rejected',marker=NULL,error=NULL WHERE key=?").run(key);
  }
  snapshot(key: string, payload: unknown) {
    this.db.query("INSERT INTO setup_snapshots(resource,at,payload) VALUES (?,?,?)").run(key, Date.now(), JSON.stringify(payload));
    this.db.query("DELETE FROM setup_snapshots WHERE resource=? AND id NOT IN (SELECT id FROM setup_snapshots WHERE resource=? ORDER BY id DESC LIMIT 5)").run(key, key);
  }
  acquire(owner: string, now = Date.now()) {
    return this.db.query("INSERT INTO setup_lease VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,expires=excluded.expires WHERE setup_lease.expires<? OR setup_lease.owner=?")
      .run(owner, now + 120_000, now, owner).changes === 1;
  }
  renew(owner: string) {
    return this.db.query("UPDATE setup_lease SET expires=? WHERE id=1 AND owner=?").run(Date.now() + 120_000, owner).changes === 1;
  }
  release(owner: string) { this.db.query("DELETE FROM setup_lease WHERE id=1 AND owner=?").run(owner); }
  pending() { return this.db.query("SELECT * FROM managed_resources WHERE state IN ('creating','review') ORDER BY started").all() as ManagedResource[]; }
}

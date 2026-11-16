import { S3Client } from "bun";
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import type { Database } from "bun:sqlite";
import { publicUrl } from "./legal_config";
import { DAY, timestamp, PublicError } from "./feature_base";

const MAGIC = Buffer.from("GORBACKUP1\n");
export function backupKey(value: string) {
  const key = Buffer.from(value,"base64");
  if (key.length !== 32 || key.toString("base64") !== value) throw new PublicError("Der Sicherungsschlüssel muss geschützt als 32-Byte-Base64-Wert hinterlegt sein.");
  return key;
}
export function encryptBackup(data: Uint8Array, key: Uint8Array) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm",key,iv);
  cipher.setAAD(MAGIC);
  const encrypted = Buffer.concat([cipher.update(data),cipher.final()]);
  return Buffer.concat([MAGIC,iv,cipher.getAuthTag(),encrypted]);
}
export function decryptBackup(data: Uint8Array, key: Uint8Array) {
  const buffer = Buffer.from(data);
  if (buffer.length < MAGIC.length+28 || !buffer.subarray(0,MAGIC.length).equals(MAGIC)) throw new PublicError("Unbekanntes Sicherungsformat.");
  const decipher = createDecipheriv("aes-256-gcm",key,buffer.subarray(MAGIC.length,MAGIC.length+12));
  decipher.setAAD(MAGIC); decipher.setAuthTag(buffer.subarray(MAGIC.length+12,MAGIC.length+28));
  try { return Buffer.concat([decipher.update(buffer.subarray(MAGIC.length+28)),decipher.final()]); }
  catch { throw new PublicError("Sicherungsschlüssel oder Integritätsprüfung stimmen nicht."); }
}
type Settings = { db: Database; setting(key: string,value?: string): string | undefined };
type Bucket = { file(key: string): { write(data: Uint8Array): Promise<unknown>; arrayBuffer(): Promise<ArrayBuffer>; delete(): Promise<unknown> } };
export class RemoteBackup {
  state = "not_configured";
  running = false;
  private bucket?: Bucket;
  private key?: Buffer;
  private prefix: string;
  constructor(readonly store: Settings, readonly guild: string, readonly env: Record<string,string|undefined>, readonly ledger: () => unknown, bucket?: Bucket) {
    this.prefix = `gor-discord/${guild}/v44/`;
    if (bucket) { this.bucket = bucket; this.key = backupKey(env.GOR_BACKUP_KEY || ""); this.state="configured"; return; }
    const names = ["GOR_BACKUP_KEY","GOR_BACKUP_S3_BUCKET","GOR_BACKUP_S3_ENDPOINT","GOR_BACKUP_S3_ACCESS_KEY","GOR_BACKUP_S3_SECRET_KEY"];
    if (!names.some(name=>env[name])) return;
    if (!names.every(name=>env[name]) || env.GOR_BACKUP_REMOTE_APPROVED !== "true") { this.state="configuration_required"; return; }
    try {
      const endpoint = publicUrl(env.GOR_BACKUP_S3_ENDPOINT!), bucketName=env.GOR_BACKUP_S3_BUCKET!;
      if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucketName)) throw new Error();
      this.key = backupKey(env.GOR_BACKUP_KEY!);
      this.bucket = new S3Client({ bucket:bucketName,endpoint,accessKeyId:env.GOR_BACKUP_S3_ACCESS_KEY!,secretAccessKey:env.GOR_BACKUP_S3_SECRET_KEY!,
        region:env.GOR_BACKUP_S3_REGION || "auto" }) as unknown as Bucket;
      this.state="configured";
    } catch { this.state="configuration_required"; }
  }
  async checkedWrite(name: string, plain: Uint8Array) {
    const encrypted = encryptBackup(plain,this.key!);
    const file = this.bucket!.file(this.prefix+name); await file.write(encrypted);
    const confirmed = Buffer.from(await file.arrayBuffer());
    const a=createHash("sha256").update(encrypted).digest(), b=createHash("sha256").update(confirmed).digest();
    if (!timingSafeEqual(a,b)) throw new PublicError("Die externe Sicherung wurde noch nicht bestätigt.");
  }
  async run(force=false, at=timestamp()) {
    if (!this.bucket || !this.key || this.running) return;
    this.running=true;
    try {
      const ledger = JSON.stringify(this.ledger()), digest=createHash("sha256").update(ledger).digest("hex");
      if (digest !== this.store.setting("backup_ledger_digest_v44")) {
        await this.checkedWrite("current-erasure-ledger.gorbak",Buffer.from(ledger));
        this.store.setting("backup_ledger_digest_v44",digest);
      }
      if (!force && at-Number(this.store.setting("backup_remote_at_v44")||0)<DAY) { this.state="verified"; return; }
      const snapshot = this.store.db.serialize();
      let pending:{name:string;at:number}|null=null;try{pending=JSON.parse(this.store.setting("backup_remote_pending_v44")||"null");}catch{}
      if(!pending || !/^snapshot-\d+-[0-9a-f-]{36}\.gorbak$/.test(pending.name))pending={name:`snapshot-${at}-${crypto.randomUUID()}.gorbak`,at};
      this.store.setting("backup_remote_pending_v44",JSON.stringify(pending));const name=pending.name;
      const bundle=Buffer.from(JSON.stringify({ format:1,guild:this.guild,created:at,database:Buffer.from(snapshot).toString("base64"),ledger:JSON.parse(ledger) }));
      await this.checkedWrite(name,bundle);
      let manifest: { name:string; at:number }[]=[]; try { manifest=JSON.parse(this.store.setting("backup_remote_manifest_v44")||"[]"); } catch {}
      manifest=manifest.filter(item=>item.name!==name);manifest.push({name,at});
      this.store.setting("backup_remote_manifest_v44",JSON.stringify(manifest));
      for (const item of [...manifest]) if (item.at<at-30*DAY && /^snapshot-\d+-[0-9a-f-]{36}\.gorbak$/.test(item.name)) {
        await this.bucket.file(this.prefix+item.name).delete(); manifest=manifest.filter(m=>m.name!==item.name);
        this.store.setting("backup_remote_manifest_v44",JSON.stringify(manifest));
      }
      this.store.setting("backup_remote_at_v44",String(at));this.store.setting("backup_remote_pending_v44","null"); this.state="verified";
    } catch { this.state="attention"; }
    finally { this.running=false; }
  }
}

/** Offline restore verification. Never overwrite a live database or a pre-existing destination. */
import { Database } from "bun:sqlite";
import { writeFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { decryptBackup, backupKey } from "./backup_remote";
import { CommunityState } from "./community_state";
import { ErasureLedger } from "./retention";
import { DAY, timestamp, PublicError } from "./feature_base";

export function restoreSnapshot(snapshot:Uint8Array,currentLedger:Uint8Array,key:Uint8Array,guild:string,at=timestamp()) {
  let bundle:any,ledger:any;
  try{bundle=JSON.parse(decryptBackup(snapshot,key).toString());ledger=JSON.parse(decryptBackup(currentLedger,key).toString());}
  catch(error){if(error instanceof PublicError)throw error;throw new PublicError("Die verschlüsselte Sicherung ist nicht als gültiges Paket lesbar.");}
  if(bundle.format!==1 || bundle.guild!==guild || !Number.isFinite(bundle.created) || bundle.created<at-30*DAY || bundle.created>at+300)
    throw new PublicError("Sicherungsformat, Zielserver oder zulässiger 30-Tage-Zeitraum stimmen nicht.");
  if(ledger.format!==1 || !Array.isArray(ledger.entries) || !Number.isSafeInteger(ledger.highwater) || ledger.highwater<0 || ledger.highwater<(bundle.ledger?.highwater||0))
    throw new PublicError("Das aktuelle getrennte Löschjournal fehlt, ist ungültig oder älter als der Sicherungsstand.");
  if(typeof bundle.database!=="string" || bundle.database.length>128*1024*1024)throw new PublicError("Die Datenbankgröße muss getrennt geprüft werden.");
  const bytes=Buffer.from(bundle.database,"base64");
  if(bytes.subarray(0,16).toString()!=="SQLite format 3\u0000")throw new PublicError("Das Paket enthält keine gültige SQLite-Datenbank.");
  // A serialized WAL image cannot be opened by SQLite's in-memory deserialize path.
  // Use a private temporary database and normalize its journal mode before returning the image.
  const temporary=mkdtempSync(join(tmpdir(),"gor-restore-")),path=join(temporary,"support.sqlite");
  writeFileSync(path,bytes,{mode:0o600,flag:"wx"});
  let db:Database;
  try{db=new Database(path,{strict:true});}catch(error){rmSync(temporary,{recursive:true,force:true});throw error;}
  try {
    if((db.query("PRAGMA quick_check").get() as any).quick_check!=="ok")throw new PublicError("Die wiederhergestellte Datenbank besteht die Integritätsprüfung nicht.");
    db.exec("PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;");
    new CommunityState(db,guild);
    const settings={db,directory:"",setting:(name:string,value?:string)=>{
      if(value!==undefined)db.query("INSERT OR REPLACE INTO settings VALUES (?,?)").run(name,value);
      return (db.query("SELECT value FROM settings WHERE key=?").get(name) as any)?.value as string|undefined;
    },get:(_id:number):any=>{throw new Error("Not used by offline restore");}};
    const bound=settings.setting("bound_guild_v44");if(bound && bound!==guild)throw new PublicError("Diese Sicherung gehört zu einem anderen Server.");
    settings.setting("bound_guild_v44",guild);
    const erasures=new ErasureLedger(settings);
    for(const row of ledger.entries) {
      if(!Number.isSafeInteger(row.case_id) || row.case_id<1 || row.case_id>ledger.highwater || !Number.isFinite(row.at) || row.at>at+300)
        throw new PublicError("Ein aktueller Löschjournaleintrag ist ungültig.");
      erasures.eraseMetadata(row.case_id,row.at);
    }
    settings.setting("case_id_highwater",String(Math.max(ledger.highwater,Number(settings.setting("case_id_highwater")||0))));
    // A copied remote timestamp is not a fresh verification of a new deployment.
    settings.setting("backup_remote_at_v44","0");settings.setting("backup_ledger_digest_v44","");
    return {database:db.serialize(),ledger,created:bundle.created,erased:ledger.entries.length};
  } finally {db.close();rmSync(temporary,{recursive:true,force:true});}
}

if(import.meta.main) {
  try {
    const args=process.argv.slice(2),value=(flag:string)=>{const i=args.indexOf(flag);return i>=0?args[i+1]:undefined;};
    const snapshot=value("--snapshot"),ledger=value("--ledger"),out=value("--out");
    if(!snapshot || !ledger || Bun.env.GOR_RESTORE_LEDGER_CONFIRMED!=="true")throw new PublicError("Benötigt --snapshot, --ledger und die geschützte Bestätigung GOR_RESTORE_LEDGER_CONFIRMED=true nach Prüfung des aktuellen getrennten Löschjournals.");
    if(out && existsSync(resolve(out)))throw new PublicError("Das Ziel existiert bereits. Eine aktive Datenbank wird nie überschrieben.");
    if(Bun.file(snapshot).size>128*1024*1024 || Bun.file(ledger).size>16*1024*1024)throw new PublicError("Die Sicherungsdateien sind für diesen Prüflauf zu groß.");
    const restored=restoreSnapshot(new Uint8Array(await Bun.file(snapshot).arrayBuffer()),new Uint8Array(await Bun.file(ledger).arrayBuffer()),backupKey(Bun.env.GOR_BACKUP_KEY||""),"1571171516677361704");
    if(out)writeFileSync(resolve(out),restored.database,{mode:0o600,flag:"wx"});
    console.log(JSON.stringify({restore_check:"passed",database_written:!!out,erasure_entries_applied:restored.erased}));
  } catch(error) {console.error(error instanceof PublicError?error.message:"Die Rücksicherung konnte nicht sicher bestätigt werden. Dateien und Schlüssel geschützt prüfen.");process.exitCode=1;}
}

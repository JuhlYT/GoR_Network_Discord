import { resolve } from "node:path";

/** Normalize configured paths identically before and after dropping container privileges. */
export function storageLocation(env: Record<string, string | undefined>, base = process.cwd(), fallback = "./betrieb") {
  const clean = (input: string | undefined) => {
    let value = input?.trim() || "";
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))))
      value = value.slice(1, -1).trim();
    return value;
  };
  const volume = clean(env.RAILWAY_VOLUME_MOUNT_PATH);
  const configured = volume || clean(env.GOR_DATA_DIR) || fallback;
  return { directory: resolve(base, configured), hasVolume: !!volume };
}

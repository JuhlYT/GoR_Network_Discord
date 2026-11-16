import { PublicError } from "./feature_base";
import { createHash } from "node:crypto";

export const LEGAL_FIELDS = {
  notice: ["Betreiberangaben", "GOR_IMPRESSUM_URL"], privacy: ["Datenschutzhinweise", "GOR_PRIVACY_URL"],
  contact: ["Kontakt ohne Discord-Konto", "GOR_CONTACT_URL"], payment: ["Geschützter Zahlungs-Support", "GOR_PAYMENT_SUPPORT_URL"],
  appeal: ["Einspruch ohne Serverzugang", "GOR_APPEAL_URL"],
} as const;
export type LegalLinks = Partial<Record<keyof typeof LEGAL_FIELDS, string>>;
type Settings = { setting(key: string, value?: string): string | undefined };
export function publicUrl(input: string) {
  if (input.length > 500 || /[\r\n<>\s]/.test(input)) throw new PublicError("Bitte einen vollständigen HTTPS-Link ohne Leerzeichen verwenden.");
  let url: URL; try { url = new URL(input); } catch { throw new PublicError("Bitte einen gültigen HTTPS-Link verwenden."); }
  if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search || url.port
      || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname) || /(^|\.)(localhost|local|internal)$/i.test(url.hostname))
    throw new PublicError("Öffentliche Kontaktlinks benötigen HTTPS und dürfen keine Zugangsdaten oder persönlichen Zugangsparameter enthalten.");
  const normalized=url.toString();if(normalized.length>500)throw new PublicError("Der normalisierte Link ist zu lang. Bitte einen kürzeren öffentlichen Kontaktweg verwenden.");
  return normalized;
}
export function legalConfig(store: Settings, env: Record<string, string | undefined> = {}) {
  let saved: LegalLinks = {}; try { saved = JSON.parse(store.setting("legal_links_v44") || "{}"); } catch {}
  const links: LegalLinks = {}, invalid: string[] = [];
  for (const [key, [label, variable]] of Object.entries(LEGAL_FIELDS)) {
    const value = env[variable]?.trim() || saved[key as keyof LegalLinks];
    if (value) try { links[key as keyof LegalLinks] = publicUrl(value); } catch { invalid.push(label); }
  }
  const reviewed = store.setting("legal_reviewed_v44") === "true" && store.setting("legal_review_digest_v44")===legalDigest(links);
  const missing = Object.entries(LEGAL_FIELDS).filter(([key]) => !links[key as keyof LegalLinks]).map(([, [label]]) => label);
  return { links, reviewed, missing, invalid, ready: reviewed && !missing.length && !invalid.length };
}
export function legalDigest(links:LegalLinks) {return createHash("sha256").update(JSON.stringify(Object.entries(links).sort(([a],[b])=>a.localeCompare(b)))).digest("hex");}
export function saveLegalLinks(store: Settings, values: LegalLinks) {
  const clean: LegalLinks = {};
  for (const key of Object.keys(LEGAL_FIELDS) as (keyof LegalLinks)[]) {
    if (values[key]?.trim()) clean[key] = publicUrl(values[key]!.trim());
  }
  store.setting("legal_links_v44", JSON.stringify(clean));
  store.setting("legal_reviewed_v44", "false");
  return clean;
}
export function privacyContacts(store: Settings, env: Record<string, string | undefined> = {}) {
  const raw = env.GOR_PRIVACY_USER_IDS || store.setting("privacy_contacts_v44") || "";
  return raw.split(/[\s,]+/).filter(value => /^\d{15,22}$/.test(value)).slice(0, 4);
}

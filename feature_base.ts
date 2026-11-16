/** Errors that are safe to show to the person using the bot. Never wrap API bodies here. */
export class PublicError extends Error {
  constructor(message: string, public readonly code = "feature_validation") { super(message); }
}
export const DAY = 86_400;
export const timestamp = () => Math.floor(Date.now() / 1000);
export function snowflake(value: string) {
  if (!/^\d{15,22}$/.test(value)) throw new PublicError("Bitte eine gültige Discord-ID verwenden.");
  return value;
}
export function cleanText(value: string, max: number, label = "Text") {
  const text = value.trim();
  if (!text || text.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text))
    throw new PublicError(`${label}: Bitte 1 bis ${max} Zeichen verwenden.`);
  return text;
}
export function addMonth(seconds: number) {
  const date = new Date(seconds * 1000), day = date.getUTCDate();
  date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + 1);
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, end)); return Math.floor(date.getTime() / 1000);
}
export function cents(amount: number) {
  const result = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000 || Math.abs(amount * 100 - result) > 0.000001)
    throw new PublicError("Beträge bitte in Euro mit höchstens zwei Nachkommastellen angeben.");
  return result;
}
export const money = (amount: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount / 100);

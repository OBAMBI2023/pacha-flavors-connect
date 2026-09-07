/**
 * Single source of truth for every click-to-WhatsApp link in the app.
 *
 * Format: https://api.whatsapp.com/send/?phone=<digits>&text=<encoded> --
 * never wa.me. `phone` is always digits-only, dial code + local number
 * concatenated with NOTHING stripped in between.
 *
 * Côte d'Ivoire (dial code 225) is the one country every tenant operates in
 * today. Its 2021 numbering reform folded the old trunk prefix into the
 * subscriber's actual 10-digit number, so "07XXXXXXXX" IS the real number
 * end-to-end: the leading 0 is part of the subscriber number and must never
 * be stripped when prefixing the country code (unlike classic E.164
 * formatting, which drops a leading trunk 0). The canonical shape used
 * everywhere in this app is therefore "225" + the untouched 10-digit local
 * number, e.g. "2250758483726" -- never "225758483726".
 */
export const DEFAULT_WHATSAPP_DIAL_CODE = "225";

/** SAOVIA Technologies' own support/partner WhatsApp number (platform-level, distinct from any tenant's own number). */
export const SAOVIA_SUPPORT_WHATSAPP_NUMBER = "2250758483726";

/**
 * Normalizes any local/international representation of a phone number to
 * the app's canonical digits-only WhatsApp number. Examples (dial code 225):
 *   "2250758483726"        -> "2250758483726"  (already canonical)
 *   "0758483726"            -> "2250758483726"  (local -- dial code prepended, 0 kept)
 *   "+2250758483726"        -> "2250758483726"
 *   "+225 07 58 48 37 26"   -> "2250758483726"
 *   "07 58 48 37 26"        -> "2250758483726"
 *
 * `dialCode` defaults to Côte d'Ivoire but accepts a tenant's own
 * country_settings.dial_code (see @/lib/mapsConfig) so a future non-CI
 * tenant's number is prefixed with its own dial code instead of being
 * silently forced into "225...".
 */
export function normalizeWhatsAppPhone(phone: string, dialCode: string = DEFAULT_WHATSAPP_DIAL_CODE): string {
  const digits = phone.replace(/\D/g, "");
  const dial = dialCode.replace(/\D/g, "") || DEFAULT_WHATSAPP_DIAL_CODE;
  // Already carries the dial code (long enough that it can't just be a
  // coincidental prefix on a bare local number) -- leave it untouched.
  if (digits.startsWith(dial) && digits.length > 10) return digits;
  return `${dial}${digits}`;
}

/**
 * Builds a click-to-WhatsApp URL in this app's canonical
 * api.whatsapp.com/send/ format. `text=` is always present -- empty (never
 * omitted, never `&text` with no `=`) when no message is given.
 */
export function buildWhatsAppUrl(phone: string, message?: string, dialCode: string = DEFAULT_WHATSAPP_DIAL_CODE): string {
  const normalized = normalizeWhatsAppPhone(phone, dialCode);
  const text = message ? encodeURIComponent(message) : "";
  return `https://api.whatsapp.com/send/?phone=${normalized}&text=${text}`;
}

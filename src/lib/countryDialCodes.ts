/**
 * Static country dial-code list for the checkout phone field's country
 * selector. No npm dependency for this -- it's a small, rarely-changing
 * dataset, and the project has no phone/i18n library installed already (see
 * PhoneNumberField.tsx for why pulling one in wasn't worth it here).
 *
 * Flags are rendered from the ISO 3166-1 alpha-2 code via Unicode regional
 * indicator symbols (flagEmoji below) instead of being hand-typed per row --
 * one less place to get wrong, and it covers any code added later for free.
 */
export type CountryDialCode = {
  iso2: string;
  name: string;
  dialCode: string;
};

/** Côte d'Ivoire is the default -- every tenant in this system operates there today, but this is only ever the checkout's *starting* selection: the customer can change it to any country below (see PhoneNumberField.tsx). Never used to force a country. */
export const DEFAULT_DIAL_CODE = "225";

export const COUNTRY_DIAL_CODES: CountryDialCode[] = [
  { iso2: "CI", name: "Côte d'Ivoire", dialCode: "225" },
  { iso2: "SN", name: "Sénégal", dialCode: "221" },
  { iso2: "ML", name: "Mali", dialCode: "223" },
  { iso2: "BF", name: "Burkina Faso", dialCode: "226" },
  { iso2: "GH", name: "Ghana", dialCode: "233" },
  { iso2: "GN", name: "Guinée", dialCode: "224" },
  { iso2: "TG", name: "Togo", dialCode: "228" },
  { iso2: "BJ", name: "Bénin", dialCode: "229" },
  { iso2: "NE", name: "Niger", dialCode: "227" },
  { iso2: "NG", name: "Nigéria", dialCode: "234" },
  { iso2: "LR", name: "Liberia", dialCode: "231" },
  { iso2: "SL", name: "Sierra Leone", dialCode: "232" },
  { iso2: "GW", name: "Guinée-Bissau", dialCode: "245" },
  { iso2: "GM", name: "Gambie", dialCode: "220" },
  { iso2: "MR", name: "Mauritanie", dialCode: "222" },
  { iso2: "CV", name: "Cap-Vert", dialCode: "238" },
  { iso2: "CM", name: "Cameroun", dialCode: "237" },
  { iso2: "GA", name: "Gabon", dialCode: "241" },
  { iso2: "CD", name: "RD Congo", dialCode: "243" },
  { iso2: "CG", name: "Congo", dialCode: "242" },
  { iso2: "MA", name: "Maroc", dialCode: "212" },
  { iso2: "DZ", name: "Algérie", dialCode: "213" },
  { iso2: "TN", name: "Tunisie", dialCode: "216" },
  { iso2: "FR", name: "France", dialCode: "33" },
  { iso2: "BE", name: "Belgique", dialCode: "32" },
  { iso2: "CH", name: "Suisse", dialCode: "41" },
  { iso2: "CA", name: "Canada", dialCode: "1" },
  { iso2: "US", name: "États-Unis", dialCode: "1" },
  { iso2: "GB", name: "Royaume-Uni", dialCode: "44" },
  { iso2: "DE", name: "Allemagne", dialCode: "49" },
  { iso2: "IT", name: "Italie", dialCode: "39" },
  { iso2: "ES", name: "Espagne", dialCode: "34" },
  { iso2: "PT", name: "Portugal", dialCode: "351" },
  { iso2: "LB", name: "Liban", dialCode: "961" },
  { iso2: "AE", name: "Émirats arabes unis", dialCode: "971" },
  { iso2: "CN", name: "Chine", dialCode: "86" },
  { iso2: "IN", name: "Inde", dialCode: "91" },
];

/** Regional indicator symbols run from U+1F1E6 ("A") in the same order as ASCII letters, so an ISO2 code maps to its flag by shifting each letter's code point. */
export function flagEmoji(iso2: string): string {
  const codePoints = [...iso2.toUpperCase()].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...codePoints);
}

export function findCountryByDialCode(dialCode: string): CountryDialCode | undefined {
  return COUNTRY_DIAL_CODES.find((c) => c.dialCode === dialCode);
}

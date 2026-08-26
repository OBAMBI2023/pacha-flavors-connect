/**
 * Per-tenant configurable currency. `restaurants.currency` (text, default
 * 'XOF') is the single source of truth in the DB -- create_order/get_public_menu
 * already read and propagate it, so every already-fetched restaurant/order
 * row carries the tenant's real currency. This module only adds the
 * supported-currency list (for the Admin picker) and a shared formatter so
 * every display site renders it the same way instead of a hardcoded string.
 */

export type CurrencyOption = {
  code: string;
  label: string;
  /** Displayed suffix after the amount (e.g. "1 500 FCFA", "1 500 XOF", "20 EUR"). */
  symbol: string;
};

export const SUPPORTED_CURRENCIES: readonly CurrencyOption[] = [
  { code: "XOF", label: "Franc CFA (UEMOA) — XOF", symbol: "FCFA" },
  { code: "XAF", label: "Franc CFA (CEMAC) — XAF", symbol: "FCFA" },
  { code: "EUR", label: "Euro — EUR", symbol: "€" },
  { code: "USD", label: "Dollar américain — USD", symbol: "$" },
  { code: "MAD", label: "Dirham marocain — MAD", symbol: "MAD" },
  { code: "GBP", label: "Livre sterling — GBP", symbol: "£" },
  { code: "CAD", label: "Dollar canadien — CAD", symbol: "$" },
  { code: "GHS", label: "Cedi ghanéen — GHS", symbol: "GH₵" },
  { code: "NGN", label: "Naira nigérian — NGN", symbol: "₦" },
];

/** Existing tenants predate this feature and must keep behaving exactly as before. */
export const DEFAULT_CURRENCY_CODE = "XOF";

/** Falls back to the raw code itself for a currency outside the curated list, so an unlisted code still renders instead of silently disappearing. */
export function currencySymbol(code: string | null | undefined): string {
  const normalized = code?.trim();
  if (!normalized) return DEFAULT_CURRENCY_CODE;
  return SUPPORTED_CURRENCIES.find((c) => c.code === normalized)?.symbol ?? normalized;
}

/**
 * The single money-formatting helper for the whole app: same "amount + space
 * + currency" convention every screen already used with a hardcoded "FCFA"
 * suffix, just with the suffix now resolved from the tenant's own currency.
 * Never touches the numeric amount itself -- no conversion, display only.
 */
export function formatMoney(amount: number, currencyCode: string | null | undefined): string {
  return `${amount.toLocaleString("fr-FR")} ${currencySymbol(currencyCode)}`;
}

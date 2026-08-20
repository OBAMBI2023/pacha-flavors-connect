export function formatMoney(amount: number, currency = "XOF"): string {
  return `${Math.round(amount).toLocaleString("fr-FR")} ${currency}`;
}

export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rem = Math.round(minutes % 60);
  return rem > 0 ? `${hours} h ${rem} min` : `${hours} h`;
}

/** Percentage change from `previous` to `current`, or null when not meaningful (previous is 0 but current isn't). */
export function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

/**
 * No column/RPC anywhere gives a driver their own commission/earning figure
 * -- `orders.total_amount` is what the customer paid, not what the driver
 * keeps, and `payments` is restaurant-staff-only via RLS (no driver-scoped
 * policy exists). Rather than presenting total_amount as if it were "gains"
 * (a real business-meaning that doesn't exist in this schema), this card
 * always renders the honest unavailable state. The `amount` prop is kept so
 * this component is ready to display a real figure the moment a genuine
 * driver-earnings source is added, without a rewrite.
 */
export function EarningsCard({ label, amount }: { label: string; amount: number | null }) {
  return (
    <div className="rounded-2xl bg-card p-4 text-center shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-bold text-foreground">{amount === null ? "--" : `${amount.toLocaleString("fr-FR")} FCFA`}</p>
    </div>
  );
}

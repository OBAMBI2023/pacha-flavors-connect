import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { formatMoney } from "@/components/admin/stats/format";
import { StatCard } from "@/components/admin/stats/StatCard";
import { PERIOD_LABELS, PERIOD_PRESETS, resolvePeriod, type PeriodPreset, type PeriodRange } from "@/components/admin/stats/periodPresets";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/components/admin/orders/paymentStatusMeta";

function toInputDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function FinancialPanel() {
  const [preset, setPreset] = useState<PeriodPreset>("last7");
  const [customRange, setCustomRange] = useState<PeriodRange>(() => resolvePeriod("today"));
  const period = useMemo(() => resolvePeriod(preset, customRange), [preset, customRange]);
  const { stats, loading, error, refresh } = useDashboardStats(period);
  const currency = "XOF";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Finances</h2>
          <p className="text-sm text-muted-foreground">Paiements, encaissements et remboursements -- distincts du pipeline de commandes.</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="h-11">
          <RotateCcw className="mr-2 h-4 w-4" /> Actualiser
        </Button>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2">
          {PERIOD_PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                preset === p ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {preset === "custom" && (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4">
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Du</span>
            <input
              type="date"
              value={toInputDate(customRange.start)}
              onChange={(e) => {
                const [y, m, d] = e.target.value.split("-").map(Number);
                if (!y || !m || !d) return;
                setCustomRange((c) => ({ ...c, start: new Date(y, m - 1, d, 0, 0, 0, 0) }));
              }}
              className="block h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Au</span>
            <input
              type="date"
              value={toInputDate(customRange.end)}
              onChange={(e) => {
                const [y, m, d] = e.target.value.split("-").map(Number);
                if (!y || !m || !d) return;
                setCustomRange((c) => ({ ...c, end: new Date(y, m - 1, d, 23, 59, 59, 999) }));
              }}
              className="block h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>
        </div>
      )}

      {error && <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}

      {loading && !stats ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Chargement des données financières...</p>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="GMV (valeur totale des commandes)" value={formatMoney(stats.current.gmv, currency)} hint="Toutes commandes non annulées" />
            <StatCard label="CA encaissé" value={formatMoney(stats.collected_revenue, currency)} hint="Paiements confirmés sur la période" />
            <StatCard label="À encaisser" value={formatMoney(stats.current.pending_collection, currency)} hint="Cash en attente, paiements non confirmés" />
            <StatCard label="Remboursé" value={formatMoney(stats.refunded_amount, currency)} hint="Total remboursements enregistrés" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-semibold">Paiements par statut</h3>
              {stats.payment_breakdown.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Aucune commande sur cette période.</p>
              ) : (
                <div className="mt-4 space-y-2">
                  {stats.payment_breakdown.map((row) => (
                    <div key={row.payment_status} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                      <span>{PAYMENT_STATUS_LABELS[row.payment_status]}</span>
                      <span className="text-muted-foreground">
                        {row.orders_count} commande(s) · <span className="font-semibold text-foreground">{formatMoney(row.amount, currency)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-semibold">CA par méthode de paiement</h3>
              {stats.method_breakdown.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Aucune commande sur cette période.</p>
              ) : (
                <div className="mt-4 space-y-2">
                  {stats.method_breakdown.map((row) => (
                    <div key={row.payment_method} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                      <span>{PAYMENT_METHOD_LABELS[row.payment_method]}</span>
                      <span className="text-muted-foreground">
                        {row.orders_count} commande(s) · <span className="font-semibold text-foreground">{formatMoney(row.amount, currency)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}

import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { formatMinutes, formatMoney, pctDelta } from "./format";
import { StatCard } from "./StatCard";
import { RevenueChart } from "./RevenueChart";
import { HourlyDistributionChart, WeekdayDistributionChart } from "./DistributionChart";
import { SOURCE_LABELS } from "./sourceLabels";
import { PERIOD_LABELS, PERIOD_PRESETS, resolvePeriod, type PeriodPreset, type PeriodRange } from "./periodPresets";

function toInputDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function StatisticsPanel() {
  const [preset, setPreset] = useState<PeriodPreset>("last7");
  const [customRange, setCustomRange] = useState<PeriodRange>(() => resolvePeriod("today"));

  const period = useMemo(() => resolvePeriod(preset, customRange), [preset, customRange]);
  const { stats, loading, error, refresh } = useDashboardStats(period);

  const currency = stats?.current ? "XOF" : "XOF";
  const revenueDelta = stats ? pctDelta(stats.current.revenue, stats.previous.revenue) : null;
  const ordersDelta = stats ? pctDelta(stats.current.orders_count, stats.previous.orders_count) : null;
  const aovDelta =
    stats && stats.current.average_order_value !== null && stats.previous.average_order_value !== null
      ? pctDelta(stats.current.average_order_value, stats.previous.average_order_value)
      : null;

  const marketplace = stats?.source_breakdown.find((s) => s.source === "marketplace") ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Statistiques</h2>
          <p className="text-sm text-muted-foreground">Pilotez votre activité : chiffre d'affaires, commandes et performance.</p>
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
                const start = new Date(y, m - 1, d, 0, 0, 0, 0);
                setCustomRange((c) => ({ ...c, start }));
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
                const end = new Date(y, m - 1, d, 23, 59, 59, 999);
                setCustomRange((c) => ({ ...c, end }));
              }}
              className="block h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>
        </div>
      )}

      {error && <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}

      {loading && !stats ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Chargement des statistiques...</p>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Chiffre d'affaires" value={formatMoney(stats.current.revenue, currency)} comparisonPct={revenueDelta} />
            <StatCard label="Commandes" value={String(stats.current.orders_count)} comparisonPct={ordersDelta} />
            <StatCard
              label="Panier moyen"
              value={stats.current.average_order_value !== null ? formatMoney(stats.current.average_order_value, currency) : "—"}
              comparisonPct={aovDelta}
            />
            <StatCard label="Articles vendus" value={String(stats.current.items_sold)} />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <StatCard
              label="Taux d'annulation"
              value={`${stats.current.cancellation_rate}%`}
              hint={`${stats.current.cancelled_orders} commande(s) annulée(s) · ${formatMoney(stats.current.cancelled_amount, currency)} potentiel`}
            />
            <StatCard label="CA en cours (non finalisé)" value={formatMoney(stats.current.in_progress_revenue, currency)} hint="Commandes confirmées, en préparation, prêtes ou en livraison" />
            <StatCard
              label="CA apporté par SAOVIA"
              value={marketplace ? formatMoney(marketplace.revenue, currency) : formatMoney(0, currency)}
              hint={marketplace ? `${marketplace.orders_count} commande(s) marketplace` : "Marketplace pas encore active"}
            />
          </div>

          <section className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-semibold">Évolution du chiffre d'affaires</h3>
            <div className="mt-4">
              <RevenueChart data={stats.revenue_series} />
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-semibold">Top produits</h3>
              {stats.top_products.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Aucune vente sur cette période.</p>
              ) : (
                <ol className="mt-4 space-y-2">
                  {stats.top_products.map((p, i) => (
                    <li key={p.name} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {i + 1}
                        </span>
                        <span className="min-w-0 truncate font-medium">{p.name}</span>
                      </span>
                      <span className="shrink-0 text-right text-muted-foreground">
                        {p.quantity} vendu(s) · <span className="font-semibold text-foreground">{formatMoney(p.revenue, currency)}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-semibold">Origine des commandes</h3>
              {stats.source_breakdown.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Aucune commande sur cette période.</p>
              ) : (
                <div className="mt-4 space-y-2">
                  {stats.source_breakdown.map((s) => (
                    <div key={s.source} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{SOURCE_LABELS[s.source]}</span>
                        <span className="text-muted-foreground">{s.orders_count} commande(s) · {s.share}%</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span>CA : {formatMoney(s.revenue, currency)}</span>
                        <span>Panier moyen : {s.average_order_value !== null ? formatMoney(s.average_order_value, currency) : "—"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-semibold">Commandes par heure</h3>
              <p className="text-xs text-muted-foreground">Identifiez vos heures fortes.</p>
              <div className="mt-4">
                <HourlyDistributionChart data={stats.hourly_distribution} />
              </div>
            </section>
            <section className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-semibold">Commandes par jour</h3>
              <p className="text-xs text-muted-foreground">Identifiez vos jours forts.</p>
              <div className="mt-4">
                <WeekdayDistributionChart data={stats.weekday_distribution} />
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-semibold">Performance opérationnelle</h3>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard label="Temps moyen de confirmation" value={formatMinutes(stats.operational_metrics.avg_confirmation_minutes)} />
              <StatCard label="Temps moyen de préparation" value={formatMinutes(stats.operational_metrics.avg_preparation_minutes)} />
              <StatCard label="Temps moyen de traitement" value={formatMinutes(stats.operational_metrics.avg_total_minutes)} />
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

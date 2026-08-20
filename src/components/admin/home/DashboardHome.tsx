import { useEffect, useMemo, useRef } from "react";
import { ArrowRight, ClipboardList, ExternalLink, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRealtimeOrders } from "@/hooks/useRealtimeOrders";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { STATUS_LABELS } from "@/components/admin/orders/orderStatusMeta";
import { formatMoney, pctDelta } from "@/components/admin/stats/format";
import { StatCard } from "@/components/admin/stats/StatCard";
import { RevenueChart } from "@/components/admin/stats/RevenueChart";
import { SOURCE_LABELS } from "@/components/admin/stats/sourceLabels";
import { resolvePeriod } from "@/components/admin/stats/periodPresets";

const TODAY = resolvePeriod("today");

export function DashboardHome({
  restaurantId,
  publicHref,
  onNavigateTab,
}: {
  restaurantId: string | null;
  publicHref: string;
  onNavigateTab: (tab: string) => void;
}) {
  const { orders } = useRealtimeOrders(restaurantId);
  const { stats, loading, error, refresh } = useDashboardStats(TODAY);

  const pendingCount = useMemo(() => orders.filter((o) => o.status === "pending").length, [orders]);
  const recentOrders = useMemo(() => orders.slice(0, 5), [orders]);

  // Aggregated stats don't need to be recomputed on every tick, but a new
  // order or a status change is exactly the kind of "relevant event" worth
  // refreshing the KPIs for -- this signature changes on either, and stays
  // stable otherwise so it never refetches on every render.
  const ordersSignature = useMemo(() => orders.map((o) => `${o.id}:${o.status}`).join(","), [orders]);
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    refresh();
  }, [ordersSignature, refresh]);

  const revenueDelta = stats ? pctDelta(stats.current.revenue, stats.previous.revenue) : null;
  const ordersDelta = stats ? pctDelta(stats.current.orders_count, stats.previous.orders_count) : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold">Accueil</h2>
        <p className="text-sm text-muted-foreground">Votre activité en un coup d'œil.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Chiffre d'affaires (aujourd'hui)"
          value={stats ? formatMoney(stats.current.revenue) : "—"}
          comparisonPct={revenueDelta}
        />
        <StatCard label="Commandes (aujourd'hui)" value={stats ? String(stats.current.orders_count) : "—"} comparisonPct={ordersDelta} />
        <StatCard
          label="Panier moyen"
          value={stats?.current.average_order_value !== null && stats?.current.average_order_value !== undefined ? formatMoney(stats.current.average_order_value) : "—"}
        />
        <StatCard label="Commandes en attente" value={String(pendingCount)} hint="Mise à jour en temps réel" />
      </div>

      {error && <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button className="h-11" onClick={() => onNavigateTab("commandes")}>
          <ClipboardList className="mr-2 h-4 w-4" /> Voir les commandes
        </Button>
        <Button variant="outline" className="h-11" onClick={() => onNavigateTab("menu")}>
          <UtensilsCrossed className="mr-2 h-4 w-4" /> Gérer le menu
        </Button>
        <Button variant="outline" className="h-11" onClick={() => window.open(publicHref, "_blank", "noopener,noreferrer")}>
          <ExternalLink className="mr-2 h-4 w-4" /> Voir la vitrine
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Activité récente</h3>
            <button onClick={() => onNavigateTab("commandes")} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              Tout voir <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {recentOrders.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Aucune commande pour le moment.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {recentOrders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">#{o.order_number}</span> · {o.customer_name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{STATUS_LABELS[o.status]}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-semibold">Sources des commandes (aujourd'hui)</h3>
          {loading && !stats ? (
            <p className="mt-3 text-sm text-muted-foreground">Chargement...</p>
          ) : stats && stats.source_breakdown.length > 0 ? (
            <div className="mt-4 space-y-2">
              {stats.source_breakdown.map((s) => (
                <div key={s.source} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2 text-sm">
                  <span>{SOURCE_LABELS[s.source]}</span>
                  <span className="text-muted-foreground">{s.orders_count} · {s.share}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Aucune commande aujourd'hui.</p>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-semibold">Évolution du chiffre d'affaires (aujourd'hui)</h3>
        <div className="mt-4">{stats && <RevenueChart data={stats.revenue_series} />}</div>
      </section>
    </div>
  );
}

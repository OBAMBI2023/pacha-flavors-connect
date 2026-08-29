import { useEffect, useMemo, useRef } from "react";
import {
  ArrowRight,
  Bike,
  ClipboardList,
  ImagePlus,
  Plus,
  ShoppingBag,
  Tag,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MENU_BUCKET, type DbMenuItem } from "@/lib/menu-db";
import { useRealtimeOrders } from "@/hooks/useRealtimeOrders";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import {
  STATUS_BADGE_CLASS,
  STATUS_LABELS,
  elapsedLabel,
} from "@/components/admin/orders/orderStatusMeta";
import { formatMoney, pctDelta } from "@/components/admin/stats/format";
import { StatCard } from "@/components/admin/stats/StatCard";
import { RevenueChart } from "@/components/admin/stats/RevenueChart";
import { SourceDonutChart } from "@/components/admin/stats/SourceDonutChart";
import { resolvePeriod } from "@/components/admin/stats/periodPresets";

const TODAY = resolvePeriod("today");
const LAST_30_DAYS = resolvePeriod("last30");

const QUICK_ACTIONS = [
  { icon: Plus, label: "Ajouter un plat", tab: "menu" },
  { icon: ClipboardList, label: "Voir toutes les commandes", tab: "commandes" },
  { icon: UtensilsCrossed, label: "Gérer le menu", tab: "menu" },
  { icon: Tag, label: "Ajouter une promotion", tab: "promotions" },
  { icon: TrendingUp, label: "Voir les rapports", tab: "statistiques" },
  { icon: Bike, label: "Gérer les livreurs", tab: "livreurs" },
] as const;

export function DashboardHome({
  restaurantId,
  currency,
  publicHref,
  menuItems,
  onNavigateTab,
}: {
  restaurantId: string | null;
  currency: string;
  publicHref: string;
  menuItems: DbMenuItem[];
  onNavigateTab: (tab: string) => void;
}) {
  const { orders } = useRealtimeOrders(restaurantId);
  const { stats, error, refresh } = useDashboardStats(TODAY);
  // Independent, longer-window fetch purely to rank "Plats populaires" --
  // today's stats alone would be near-empty most of the day. Same RPC/hook,
  // just a different period, so it stays real data with no new backend code.
  const { stats: statsLast30 } = useDashboardStats(LAST_30_DAYS);

  const pendingCount = useMemo(() => orders.filter((o) => o.status === "pending").length, [orders]);
  const recentOrders = useMemo(() => orders.slice(0, 5), [orders]);
  const activeItemsCount = useMemo(
    () => menuItems.filter((row) => row.available).length,
    [menuItems],
  );

  const popularProducts = useMemo(() => {
    if (!statsLast30) return [];
    const byName = new Map(menuItems.map((row) => [row.name.trim().toLowerCase(), row]));
    return statsLast30.top_products.slice(0, 4).map((product) => ({
      ...product,
      menuItem: byName.get(product.name.trim().toLowerCase()) ?? null,
    }));
  }, [statsLast30, menuItems]);

  // Aggregated stats don't need to be recomputed on every tick, but a new
  // order or a status change is exactly the kind of "relevant event" worth
  // refreshing the KPIs for -- this signature changes on either, and stays
  // stable otherwise so it never refetches on every render.
  const ordersSignature = useMemo(
    () => orders.map((o) => `${o.id}:${o.status}`).join(","),
    [orders],
  );
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    refresh();
  }, [ordersSignature, refresh]);

  const revenueDelta = stats ? pctDelta(stats.current.revenue, stats.previous.revenue) : null;
  const ordersDelta = stats
    ? pctDelta(stats.current.orders_count, stats.previous.orders_count)
    : null;

  return (
    <div className="min-w-0 space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={ShoppingBag}
          label="Commandes aujourd'hui"
          value={stats ? String(stats.current.orders_count) : "—"}
          comparisonPct={ordersDelta}
        />
        <StatCard
          icon={Wallet}
          label="Chiffre d'affaires"
          value={stats ? formatMoney(stats.current.revenue, currency) : "—"}
          comparisonPct={revenueDelta}
        />
        <StatCard
          icon={ClipboardList}
          label="Commandes en attente"
          value={String(pendingCount)}
          hint="Mise à jour en temps réel"
        />
        <StatCard
          icon={UtensilsCrossed}
          label="Plats actifs"
          value={String(activeItemsCount)}
          hint={`sur ${menuItems.length} au total`}
        />
      </div>

      {error && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_1fr]">
        <section className="min-w-0 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold">Performance des ventes</h3>
              <p className="text-xs text-muted-foreground">Aujourd'hui</p>
            </div>
            <p className="text-right">
              <span className="block font-display text-xl font-semibold">
                {stats ? formatMoney(stats.current.revenue, currency) : "—"}
              </span>
              {revenueDelta !== null && (
                <span
                  className={`text-xs font-medium ${revenueDelta >= 0 ? "text-emerald-600" : "text-destructive"}`}
                >
                  {revenueDelta >= 0 ? "+" : ""}
                  {revenueDelta.toFixed(1)}% vs hier
                </span>
              )}
            </p>
          </div>
          <div className="mt-4">{stats && <RevenueChart data={stats.revenue_series} currency={currency} />}</div>
          <div className="mt-5 border-t border-border pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Répartition des commandes
            </p>
            <div className="mt-3">
              {stats && <SourceDonutChart data={stats.source_breakdown} />}
            </div>
          </div>
        </section>

        <section className="min-w-0 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Commandes récentes</h3>
            <button
              onClick={() => onNavigateTab("commandes")}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Voir tout <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {recentOrders.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Aucune commande pour le moment.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {recentOrders.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => onNavigateTab("commandes")}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-left text-sm transition-colors hover:border-primary/40"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="font-medium">#{o.order_number}</span>
                        <span className="truncate text-muted-foreground">{o.customer_name}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {elapsedLabel(o.created_at)} · {formatMoney(o.total_amount, o.currency)}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-[0.65rem] font-semibold ${STATUS_BADGE_CLASS[o.status]}`}
                    >
                      {STATUS_LABELS[o.status]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Plats populaires</h3>
          <button
            onClick={() => onNavigateTab("menu")}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Voir tout <ArrowRight className="h-3 w-3" />
          </button>
        </div>
        {popularProducts.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Pas encore assez de commandes pour établir un classement.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {popularProducts.map((product, index) => {
              const src = product.menuItem?.image_path
                ? supabase.storage.from(MENU_BUCKET).getPublicUrl(product.menuItem.image_path).data
                    .publicUrl
                : null;
              return (
                <div
                  key={`${product.name}-${index}`}
                  className="overflow-hidden rounded-2xl border border-border bg-background"
                >
                  <div className="relative aspect-[4/3] w-full bg-muted">
                    {src ? (
                      <img
                        src={src}
                        alt={product.name}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ImagePlus className="h-6 w-6 text-muted-foreground/40" />
                      </div>
                    )}
                    <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[0.65rem] font-semibold text-primary-foreground">
                      N°{index + 1}
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-semibold">{product.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {product.quantity} commande(s)
                    </p>
                    {product.menuItem?.price != null && (
                      <p className="mt-1 text-sm font-semibold text-primary">
                        {formatMoney(product.menuItem.price, currency)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-semibold">Actions rapides</h3>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => onNavigateTab(action.tab)}
              className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3.5 text-left text-sm font-medium transition-colors hover:border-primary/40 hover:bg-accent"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                <action.icon className="h-4 w-4" aria-hidden="true" />
              </span>
              {action.label}
            </button>
          ))}
        </div>
      </section>

      <p className="text-center text-xs text-muted-foreground">
        <button
          onClick={() => window.open(publicHref, "_blank", "noopener,noreferrer")}
          className="underline underline-offset-4 hover:text-foreground"
        >
          Voir la vitrine publique
        </button>
      </p>
    </div>
  );
}

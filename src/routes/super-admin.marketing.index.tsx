import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  MessageCircle,
  Send,
  ShoppingBag,
  Store,
  Target,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { StatCard } from "@/components/admin/stats/StatCard";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/currency";
import {
  CAMPAIGN_STATUS_LABELS,
  comparisonPct,
  fetchCampaignOrdersDailySeries,
  fetchDashboardOverview,
  fetchNewCustomersDailySeries,
  fetchTopCampaigns,
  fetchTopRestaurantsByPerformance,
  fetchTopSegments,
  type DailyPoint,
  type DashboardOverview,
  type RestaurantPerformanceRow,
  type TopCampaignRow,
  type TopSegmentRow,
} from "@/lib/marketing";
import { useMarketingContext } from "@/hooks/useMarketingContext";
import { CrmPeriodPicker } from "@/components/superadmin/marketing/CrmPeriodPicker";
import {
  resolveCrmPeriod,
  type CrmPeriodPreset,
} from "@/components/superadmin/marketing/crmPeriods";
import { NewCustomersChart } from "@/components/superadmin/marketing/NewCustomersChart";
import { CampaignOrdersChart } from "@/components/superadmin/marketing/CampaignOrdersChart";
import { WhatsAppUnavailableBanner } from "@/components/superadmin/marketing/WhatsAppUnavailableBanner";
import type { DateRange } from "@/lib/marketing";

export const Route = createFileRoute("/super-admin/marketing/")({
  ssr: false,
  component: MarketingDashboardPage,
});

const STATUS_BADGE_CLASS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  scheduled: "bg-amber-100 text-amber-700",
  sending: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-500",
  failed: "bg-destructive/10 text-destructive",
};

function MarketingDashboardPage() {
  const { restaurantId, restaurant } = useMarketingContext();
  const scopeId = restaurantId === "all" ? null : restaurantId;
  const currency = restaurant?.currency ?? "XOF";

  const [preset, setPreset] = useState<CrmPeriodPreset>("30d");
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const range = resolveCrmPeriod(preset, customRange);

  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [newCustomersSeries, setNewCustomersSeries] = useState<DailyPoint[]>([]);
  const [campaignOrdersSeries, setCampaignOrdersSeries] = useState<DailyPoint[]>([]);
  const [topCampaigns, setTopCampaigns] = useState<TopCampaignRow[]>([]);
  const [topSegments, setTopSegments] = useState<TopSegmentRow[]>([]);
  const [topRestaurants, setTopRestaurants] = useState<RestaurantPerformanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchDashboardOverview(scopeId, range),
      fetchNewCustomersDailySeries(scopeId, range),
      fetchCampaignOrdersDailySeries(scopeId, range),
      fetchTopCampaigns(scopeId, range, 5),
      scopeId ? fetchTopSegments(scopeId) : Promise.resolve([]),
      scopeId === null ? fetchTopRestaurantsByPerformance(range, 5) : Promise.resolve([]),
    ])
      .then(([ov, newC, campC, top, segments, restaurants]) => {
        if (cancelled) return;
        setOverview(ov);
        setNewCustomersSeries(newC);
        setCampaignOrdersSeries(campC);
        setTopCampaigns(top);
        setTopSegments(segments);
        setTopRestaurants(restaurants);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeId, JSON.stringify(range)]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Chiffres réels
          {restaurant
            ? ` de ${restaurant.name}`
            : scopeId === null
              ? " sur tous les restaurants actifs"
              : ""}{" "}
          -- aucune donnée fictive.
        </p>
        <CrmPeriodPicker
          preset={preset}
          customRange={customRange}
          onChange={(p, r) => {
            setPreset(p);
            setCustomRange(r);
          }}
        />
      </div>

      {loading || !overview ? (
        <p className="text-sm text-slate-500">Chargement...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Users} label="Clients CRM" value={String(overview.totalCustomers)} />
            <StatCard
              icon={UserPlus}
              label="Clients actifs"
              value={String(overview.activeCustomers)}
            />
            <StatCard
              icon={Target}
              label="Nouveaux clients"
              value={String(overview.newCustomers)}
              comparisonPct={comparisonPct(overview.newCustomers, overview.previous.newCustomers)}
            />
            <StatCard
              icon={Store}
              label="Clients à relancer"
              value={String(overview.customersToRelaunch)}
            />
            <StatCard
              icon={Send}
              label="Campagnes actives"
              value={String(overview.campaignsActive)}
            />
            <StatCard
              icon={MessageCircle}
              label="Messages envoyés"
              value={String(overview.messagesSent)}
              hint="Confirmés manuellement par l'équipe"
              comparisonPct={comparisonPct(overview.messagesSent, overview.previous.messagesSent)}
            />
            <StatCard
              icon={ShoppingBag}
              label="Commandes générées"
              value={String(overview.ordersGenerated)}
              hint="Via code promo de campagne"
              comparisonPct={comparisonPct(
                overview.ordersGenerated,
                overview.previous.ordersGenerated,
              )}
            />
            <StatCard
              icon={Wallet}
              label="CA attribué"
              value={formatMoney(overview.revenueGenerated, currency)}
              hint="Commandes attribuées uniquement"
              comparisonPct={comparisonPct(
                overview.revenueGenerated,
                overview.previous.revenueGenerated,
              )}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-900">Évolution des clients</h3>
              <p className="text-xs text-slate-500">Nouveaux clients par jour</p>
              <div className="mt-3">
                <NewCustomersChart data={newCustomersSeries} />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-900">Commandes issues des campagnes</h3>
              <p className="text-xs text-slate-500">
                {overview.ordersGenerated} commande{overview.ordersGenerated > 1 ? "s" : ""} sur la
                période
              </p>
              <div className="mt-3">
                <CampaignOrdersChart data={campaignOrdersSeries} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 lg:col-span-2">
              <div className="flex items-center justify-between p-4 pb-0">
                <h3 className="font-semibold text-slate-900">Campagnes récentes</h3>
                <Link
                  to="/super-admin/marketing/campagnes"
                  className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  Voir toutes <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {topCampaigns.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">Aucune campagne sur cette période.</p>
              ) : (
                <div className="overflow-x-auto p-4 pt-3">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="text-xs uppercase text-slate-400">
                      <tr>
                        <th className="pb-2 pr-3">Campagne</th>
                        {scopeId === null && <th className="pb-2 pr-3">Restaurant</th>}
                        <th className="pb-2 pr-3">Envoyés</th>
                        <th className="pb-2 pr-3">Commandes</th>
                        <th className="pb-2 pr-3">CA généré</th>
                        <th className="pb-2">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {topCampaigns.map((c) => (
                        <tr key={c.id}>
                          <td className="py-2 pr-3 font-medium text-slate-900">{c.name}</td>
                          {scopeId === null && (
                            <td className="py-2 pr-3 text-slate-600">
                              {c.restaurant?.name ?? "--"}
                            </td>
                          )}
                          <td className="py-2 pr-3 text-slate-600">{c.recipient_count}</td>
                          <td className="py-2 pr-3 text-slate-600">{c.ordersGenerated}</td>
                          <td className="py-2 pr-3 text-slate-600">
                            {formatMoney(c.revenueGenerated, currency)}
                          </td>
                          <td className="py-2">
                            <Badge className={STATUS_BADGE_CLASS[c.status]}>
                              {CAMPAIGN_STATUS_LABELS[c.status]}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              {scopeId !== null ? (
                <>
                  <h3 className="font-semibold text-slate-900">Top audiences</h3>
                  <ul className="mt-3 space-y-2.5">
                    {topSegments.map((s) => (
                      <li key={s.key} className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">{s.label}</span>
                        <span className="font-semibold text-slate-900">{s.count}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/super-admin/marketing/audiences"
                    className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    Voir toutes <ArrowRight className="h-3 w-3" />
                  </Link>
                </>
              ) : (
                <>
                  <h3 className="font-semibold text-slate-900">Top restaurants par performance</h3>
                  {topRestaurants.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">Aucune donnée sur cette période.</p>
                  ) : (
                    <ol className="mt-3 space-y-3">
                      {topRestaurants.map((r, i) => (
                        <li key={r.restaurantId} className="flex items-center gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                            {i + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-900">
                              {r.restaurantName}
                            </p>
                            <p className="text-xs text-slate-500">
                              {r.ordersGenerated} commande{r.ordersGenerated > 1 ? "s" : ""} ·{" "}
                              {formatMoney(r.revenueGenerated, currency)}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </>
              )}
            </div>
          </div>

          <WhatsAppUnavailableBanner />
        </>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/currency";
import {
  CAMPAIGN_STATUS_LABELS,
  fetchDashboardOverview,
  fetchTopCampaigns,
  fetchTopRestaurantsByPerformance,
  fetchTopSegments,
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
import { WhatsAppUnavailableBanner } from "@/components/superadmin/marketing/WhatsAppUnavailableBanner";
import type { DateRange } from "@/lib/marketing";

export const Route = createFileRoute("/super-admin/marketing/analytics")({
  ssr: false,
  component: MarketingAnalyticsPage,
});

const STATUS_BADGE_CLASS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  scheduled: "bg-amber-100 text-amber-700",
  sending: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-500",
  failed: "bg-destructive/10 text-destructive",
};

function MarketingAnalyticsPage() {
  const { restaurantId, restaurant } = useMarketingContext();
  const scopeId = restaurantId === "all" ? null : restaurantId;
  const currency = restaurant?.currency ?? "XOF";

  const [preset, setPreset] = useState<CrmPeriodPreset>("30d");
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const range = resolveCrmPeriod(preset, customRange);

  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [topCampaigns, setTopCampaigns] = useState<TopCampaignRow[]>([]);
  const [topSegments, setTopSegments] = useState<TopSegmentRow[]>([]);
  const [topRestaurants, setTopRestaurants] = useState<RestaurantPerformanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchDashboardOverview(scopeId, range),
      fetchTopCampaigns(scopeId, range, 10),
      scopeId ? fetchTopSegments(scopeId) : Promise.resolve([]),
      fetchTopRestaurantsByPerformance(range, 10),
    ])
      .then(([ov, campaigns, segments, restaurants]) => {
        if (cancelled) return;
        setOverview(ov);
        setTopCampaigns(campaigns);
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
          Données réelles uniquement -- aucune valeur estimée n'est affichée dans ce module.
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-medium uppercase text-slate-400">Commandes attribuées</p>
              <p className="mt-1 font-display text-2xl font-semibold text-slate-900">
                {overview.ordersGenerated}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-medium uppercase text-slate-400">CA attribué</p>
              <p className="mt-1 font-display text-2xl font-semibold text-slate-900">
                {formatMoney(overview.revenueGenerated, currency)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-medium uppercase text-slate-400">Taux de conversion</p>
              <p className="mt-1 font-display text-2xl font-semibold text-slate-900">
                {overview.conversionRate === null ? "--" : `${overview.conversionRate}%`}
              </p>
              {overview.conversionRate === null && (
                <p className="text-[0.65rem] text-slate-400">
                  Non disponible (aucun message envoyé)
                </p>
              )}
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-medium uppercase text-slate-400">Messages envoyés</p>
              <p className="mt-1 font-display text-2xl font-semibold text-slate-900">
                {overview.messagesSent}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200">
            <h3 className="p-4 pb-0 font-semibold text-slate-900">
              Campagnes les plus performantes
            </h3>
            {topCampaigns.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">Aucune campagne sur cette période.</p>
            ) : (
              <div className="overflow-x-auto p-4 pt-3">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-xs uppercase text-slate-400">
                    <tr>
                      <th className="pb-2 pr-3">Campagne</th>
                      {scopeId === null && <th className="pb-2 pr-3">Restaurant</th>}
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
                          <td className="py-2 pr-3 text-slate-600">{c.restaurant?.name ?? "--"}</td>
                        )}
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

          {scopeId !== null ? (
            <div className="rounded-2xl border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-900">
                Audiences les plus rentables (par taille en direct)
              </h3>
              <ul className="mt-3 space-y-2.5">
                {topSegments.map((s) => (
                  <li key={s.key} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{s.label}</span>
                    <span className="font-semibold text-slate-900">{s.count} clients</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-900">Performance par restaurant</h3>
              {topRestaurants.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">Aucune donnée sur cette période.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead className="text-xs uppercase text-slate-400">
                      <tr>
                        <th className="pb-2 pr-3">Restaurant</th>
                        <th className="pb-2 pr-3">Commandes</th>
                        <th className="pb-2">CA attribué</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {topRestaurants.map((r) => (
                        <tr key={r.restaurantId}>
                          <td className="py-2 pr-3 font-medium text-slate-900">
                            {r.restaurantName}
                          </td>
                          <td className="py-2 pr-3 text-slate-600">{r.ordersGenerated}</td>
                          <td className="py-2 text-slate-600">
                            {formatMoney(r.revenueGenerated, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <WhatsAppUnavailableBanner compact />
        </>
      )}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Wallet, ShoppingBag, TrendingUp, Receipt } from "lucide-react";
import { fetchTenants, type TenantRow } from "@/lib/superAdminTenants";
import { fetchSuperAdminRevenueAnalytics, type SuperAdminRevenueAnalytics } from "@/lib/superAdminRevenueAnalytics";
import { fetchDashboardStats, type DashboardStats } from "@/lib/orders-db";
import { SuperAdminKpiCard } from "@/components/superadmin/SuperAdminKpiCard";
import { TenantRankingTable } from "@/components/superadmin/TenantRankingTable";
import { RevenueChart } from "@/components/admin/stats/RevenueChart";
import { formatMoney } from "@/lib/currency";

export const Route = createFileRoute("/super-admin/revenus")({
  ssr: false,
  component: SuperAdminRevenusPage,
});

const PERIOD_OPTIONS = [
  { value: 7, label: "7 derniers jours" },
  { value: 30, label: "30 derniers jours" },
  { value: 90, label: "90 derniers jours" },
];

const EMPTY_PLATFORM: SuperAdminRevenueAnalytics = {
  period_days: 30,
  kpis: { ca_total: 0, ca_livre: 0, orders_count: 0, delivered_count: 0, cancelled_count: 0, cancellation_rate: 0, average_order_value: null, active_clients: 0 },
  revenue_series: [],
  tenant_ranking: [],
};

function SuperAdminRevenusPage() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [restaurantId, setRestaurantId] = useState<string>("all");
  const [periodDays, setPeriodDays] = useState(30);
  const [platform, setPlatform] = useState<SuperAdminRevenueAnalytics>(EMPTY_PLATFORM);
  const [tenantStats, setTenantStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTenants()
      .then(setTenants)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Impossible de charger les tenants."));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        if (restaurantId === "all") {
          const data = await fetchSuperAdminRevenueAnalytics(periodDays);
          if (!cancelled) {
            setPlatform(data);
            setTenantStats(null);
          }
        } else {
          const end = new Date();
          const start = new Date(end.getTime() - periodDays * 24 * 60 * 60 * 1000);
          const data = await fetchDashboardStats(start, end, restaurantId);
          if (!cancelled) setTenantStats(data);
        }
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Impossible de charger les revenus.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [restaurantId, periodDays]);

  const activeTenants = useMemo(() => tenants.filter((t) => t.status !== "archived"), [tenants]);
  const isPlatformView = restaurantId === "all";
  // DashboardStats carries no currency field of its own; super_admin_list_tenants
  // doesn't expose one either, and this platform is single-currency (XOF) in
  // practice -- same fallback already used by super-admin.customer-map.tsx.
  const revenueCurrency = platform.tenant_ranking[0]?.currency ?? "XOF";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900 sm:text-3xl">Revenus</h1>
        <p className="mt-1 text-sm text-slate-600">Vision financière de la plateforme, globale ou par tenant.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <select
          value={restaurantId}
          onChange={(e) => setRestaurantId(e.target.value)}
          className="h-11 min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
        >
          <option value="all">Tous les tenants</option>
          {activeTenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <div className="flex flex-wrap gap-1.5">
          {PERIOD_OPTIONS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriodDays(p.value)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                periodDays === p.value ? "border-primary bg-primary text-primary-foreground" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isPlatformView ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SuperAdminKpiCard icon={TrendingUp} label="CA total" value={formatMoney(platform.kpis.ca_total, revenueCurrency)} />
            <SuperAdminKpiCard icon={Wallet} label="CA livré" value={formatMoney(platform.kpis.ca_livre, revenueCurrency)} />
            <SuperAdminKpiCard icon={ShoppingBag} label="Commandes" value={platform.kpis.orders_count.toLocaleString("fr-FR")} />
            <SuperAdminKpiCard icon={Receipt} label="Panier moyen" value={platform.kpis.average_order_value != null ? formatMoney(platform.kpis.average_order_value, revenueCurrency) : "-"} />
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">Évolution du CA</h2>
            <p className="mt-1 text-sm text-slate-500">Chiffre d&apos;affaires livré, tous tenants confondus.</p>
            <div className="mt-4">
              <RevenueChart data={platform.revenue_series} currency={revenueCurrency} />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">Classement des tenants</h2>
            <p className="mt-1 text-sm text-slate-500">Par chiffre d&apos;affaires livré sur la période.</p>
            <div className="mt-4">{loading ? <p className="text-sm text-slate-500">Chargement...</p> : <TenantRankingTable rows={platform.tenant_ranking} />}</div>
          </div>
        </>
      ) : loading || !tenantStats ? (
        <p className="text-sm text-slate-500">Chargement...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SuperAdminKpiCard icon={TrendingUp} label="CA total" value={formatMoney(tenantStats.current.gmv, "XOF")} />
            <SuperAdminKpiCard icon={Wallet} label="CA livré" value={formatMoney(tenantStats.current.revenue, "XOF")} />
            <SuperAdminKpiCard icon={ShoppingBag} label="Commandes" value={tenantStats.current.orders_count.toLocaleString("fr-FR")} />
            <SuperAdminKpiCard
              icon={Receipt}
              label="Panier moyen"
              value={tenantStats.current.average_order_value != null ? formatMoney(tenantStats.current.average_order_value, "XOF") : "-"}
            />
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">Évolution du CA</h2>
            <p className="mt-1 text-sm text-slate-500">{tenants.find((t) => t.id === restaurantId)?.name ?? "Tenant"}</p>
            <div className="mt-4">
              <RevenueChart data={tenantStats.revenue_series} currency="XOF" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

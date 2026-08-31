import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, XCircle, ShoppingBag, Wallet } from "lucide-react";
import { fetchSuperAdminRevenueAnalytics, type SuperAdminRevenueAnalytics } from "@/lib/superAdminRevenueAnalytics";
import { SuperAdminKpiCard } from "@/components/superadmin/SuperAdminKpiCard";
import { TenantRankingTable } from "@/components/superadmin/TenantRankingTable";
import { RevenueChart } from "@/components/admin/stats/RevenueChart";
import { OrdersPerDayChart } from "@/components/superadmin/OrdersPerDayChart";
import { formatMoney } from "@/lib/currency";

export const Route = createFileRoute("/super-admin/analytics")({
  ssr: false,
  component: SuperAdminAnalyticsPage,
});

const PERIOD_OPTIONS = [
  { value: 7, label: "7 derniers jours" },
  { value: 30, label: "30 derniers jours" },
  { value: 90, label: "90 derniers jours" },
];

const EMPTY: SuperAdminRevenueAnalytics = {
  period_days: 30,
  kpis: { ca_total: 0, ca_livre: 0, orders_count: 0, delivered_count: 0, cancelled_count: 0, cancellation_rate: 0, average_order_value: null, active_clients: 0 },
  revenue_series: [],
  tenant_ranking: [],
};

function SuperAdminAnalyticsPage() {
  const [periodDays, setPeriodDays] = useState(30);
  const [data, setData] = useState<SuperAdminRevenueAnalytics>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchSuperAdminRevenueAnalytics(periodDays)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Impossible de charger les analytics.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [periodDays]);

  const revenueCurrency = data.tenant_ranking[0]?.currency ?? "XOF";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900 sm:text-3xl">Analytics</h1>
        <p className="mt-1 text-sm text-slate-600">Activité de la plateforme, tous tenants confondus.</p>
      </div>

      <div className="flex flex-wrap gap-1.5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SuperAdminKpiCard icon={ShoppingBag} label="Commandes" value={data.kpis.orders_count.toLocaleString("fr-FR")} />
        <SuperAdminKpiCard icon={Wallet} label="CA livré" value={formatMoney(data.kpis.ca_livre, revenueCurrency)} />
        <SuperAdminKpiCard icon={Users} label="Clients actifs" value={data.kpis.active_clients.toLocaleString("fr-FR")} />
        <SuperAdminKpiCard icon={XCircle} label="Taux d'annulation" value={`${data.kpis.cancellation_rate.toLocaleString("fr-FR")}%`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">CA par jour</h2>
          <div className="mt-4">{loading ? <p className="text-sm text-slate-500">Chargement...</p> : <RevenueChart data={data.revenue_series} currency={revenueCurrency} />}</div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Commandes par jour</h2>
          <div className="mt-4">{loading ? <p className="text-sm text-slate-500">Chargement...</p> : <OrdersPerDayChart data={data.revenue_series} />}</div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Commandes & CA par tenant</h2>
        <p className="mt-1 text-sm text-slate-500">Classé par chiffre d&apos;affaires livré sur la période.</p>
        <div className="mt-4">{loading ? <p className="text-sm text-slate-500">Chargement...</p> : <TenantRankingTable rows={data.tenant_ranking} />}</div>
      </div>

      <p className="text-xs text-slate-400">
        Client actif = commande passée dans les 14 derniers jours (même seuil que la carte Clients et le segment marketing "Clients inactifs").
      </p>
    </div>
  );
}

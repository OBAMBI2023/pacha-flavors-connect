import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { QrCode, ShoppingBag, Target, TrendingUp, Users } from "lucide-react";
import {
  fetchSuperAdminAcquisitionOverview,
  type SuperAdminAcquisitionOverview,
  type SuperAdminAcquisitionTenantRow,
} from "@/lib/superAdminAcquisition";
import { SuperAdminKpiCard } from "@/components/superadmin/SuperAdminKpiCard";
import { RevenueChart } from "@/components/admin/stats/RevenueChart";
import { OrdersPerDayChart } from "@/components/superadmin/OrdersPerDayChart";
import { SourceDonutChart } from "@/components/admin/stats/SourceDonutChart";
import type { SourceBreakdownRow } from "@/lib/orders-db";
import { formatMoney } from "@/lib/currency";

export const Route = createFileRoute("/super-admin/acquisition")({
  ssr: false,
  component: SuperAdminAcquisitionPage,
});

const PERIOD_OPTIONS = [
  { value: 7, label: "7 derniers jours" },
  { value: 30, label: "30 derniers jours" },
  { value: 90, label: "90 derniers jours" },
];

const EMPTY: SuperAdminAcquisitionOverview = {
  period_days: 30,
  kpis: {
    attributed_orders: 0,
    attributed_revenue: 0,
    acquired_clients: 0,
    qr_orders: 0,
    qr_revenue: 0,
    qr_clients: 0,
    qr_scans: 0,
    qr_conversion_rate: null,
    tenants_with_measurable_acquisition: 0,
  },
  source_breakdown: [],
  attributed_series: [],
  qr_series: [],
  meta_pixel: { active_count: 0, inactive_count: 0, none_count: 0, total_tenants: 0, coverage_pct: 0 },
  tenant_breakdown: [],
};

function SuperAdminAcquisitionPage() {
  const [periodDays, setPeriodDays] = useState(30);
  const [data, setData] = useState<SuperAdminAcquisitionOverview>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchSuperAdminAcquisitionOverview(periodDays)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Impossible de charger l'acquisition.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [periodDays]);

  const revenueCurrency = data.tenant_breakdown[0]?.currency ?? "XOF";

  // SourceDonutChart expects SourceBreakdownRow (share + average_order_value) --
  // computed here rather than touching that already-validated component.
  const sourceRows: SourceBreakdownRow[] = useMemo(() => {
    const total = data.source_breakdown.reduce((sum, r) => sum + r.orders_count, 0);
    return data.source_breakdown.map((r) => ({
      source: r.source,
      orders_count: r.orders_count,
      revenue: r.revenue,
      share: total > 0 ? Math.round((r.orders_count / total) * 1000) / 10 : 0,
      average_order_value: null,
    }));
  }, [data.source_breakdown]);

  const byOrders = useMemo(() => [...data.tenant_breakdown].sort((a, b) => b.attributed_orders - a.attributed_orders).slice(0, 8), [data.tenant_breakdown]);
  const byRevenue = useMemo(() => [...data.tenant_breakdown].filter((t) => t.attributed_revenue > 0).slice(0, 8), [data.tenant_breakdown]);
  const withPixel = useMemo(() => data.tenant_breakdown.filter((t) => t.meta_pixel_enabled), [data.tenant_breakdown]);
  const noAcquisition = useMemo(() => data.tenant_breakdown.filter((t) => t.attributed_orders === 0), [data.tenant_breakdown]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900 sm:text-3xl">Marketing & Acquisition</h1>
        <p className="mt-1 text-sm text-slate-600">Commandes réellement attribuées (order_source), QR et couverture Meta Pixel -- tous tenants confondus.</p>
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

      {/* Module 5 -- KPI (uniquement les métriques fiables ; taux de conversion QR omis si 0 scan) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SuperAdminKpiCard icon={ShoppingBag} label="Commandes attribuées" value={data.kpis.attributed_orders.toLocaleString("fr-FR")} />
        <SuperAdminKpiCard icon={TrendingUp} label="CA attribué" value={formatMoney(data.kpis.attributed_revenue, revenueCurrency)} />
        <SuperAdminKpiCard icon={Users} label="Clients acquis" value={data.kpis.acquired_clients.toLocaleString("fr-FR")} />
        <SuperAdminKpiCard icon={Target} label="Tenants avec acquisition" value={`${data.kpis.tenants_with_measurable_acquisition} / ${data.tenant_breakdown.length}`} />
      </div>
      {data.kpis.qr_conversion_rate !== null && (
        <p className="text-xs text-slate-400">Taux de conversion QR (commandes / scans) : {data.kpis.qr_conversion_rate}%</p>
      )}

      {/* Module 1 -- Acquisition */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Évolution des commandes attribuées</h2>
          <p className="mt-1 text-sm text-slate-500">CA attribué par jour.</p>
          <div className="mt-4">{loading ? <p className="text-sm text-slate-500">Chargement...</p> : <RevenueChart data={data.attributed_series} currency={revenueCurrency} />}</div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Répartition des sources</h2>
          <p className="mt-1 text-sm text-slate-500">QR, vitrine directe, marketplace, non attribuées -- aucune source Meta (aucune commande Meta n&apos;est jamais attribuée aujourd&apos;hui).</p>
          <div className="mt-4">{loading ? <p className="text-sm text-slate-500">Chargement...</p> : <SourceDonutChart data={sourceRows} />}</div>
        </div>
      </div>

      {/* Module 3 -- QR */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">QR Code</h2>
        <p className="mt-1 text-sm text-slate-500">order_source = &apos;qr_code&apos;, même définition que la fiche tenant.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SuperAdminKpiCard icon={QrCode} label="Commandes QR" value={data.kpis.qr_orders.toLocaleString("fr-FR")} />
          <SuperAdminKpiCard icon={TrendingUp} label="CA QR" value={formatMoney(data.kpis.qr_revenue, revenueCurrency)} />
          <SuperAdminKpiCard icon={Users} label="Clients QR" value={data.kpis.qr_clients.toLocaleString("fr-FR")} />
          <SuperAdminKpiCard icon={QrCode} label="Scans QR" value={data.kpis.qr_scans.toLocaleString("fr-FR")} />
        </div>
        <div className="mt-4">{loading ? <p className="text-sm text-slate-500">Chargement...</p> : <OrdersPerDayChart data={data.qr_series} />}</div>
      </div>

      {/* Module 2 -- Meta Pixel (jamais d'ID complet, jamais présenté comme une conversion) */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Meta Pixel</h2>
        <p className="mt-1 text-sm text-slate-500">Couverture de configuration -- aucun identifiant complet affiché, aucune conversion Meta (non mesurable aujourd&apos;hui).</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SuperAdminKpiCard icon={Target} label="Pixel actif" value={data.meta_pixel.active_count.toLocaleString("fr-FR")} />
          <SuperAdminKpiCard icon={Target} label="Pixel inactif" value={data.meta_pixel.inactive_count.toLocaleString("fr-FR")} />
          <SuperAdminKpiCard icon={Target} label="Sans Pixel" value={data.meta_pixel.none_count.toLocaleString("fr-FR")} />
          <SuperAdminKpiCard icon={Target} label="Couverture plateforme" value={`${data.meta_pixel.coverage_pct}%`} />
        </div>
      </div>

      {/* Module 4 -- Classement Tenants */}
      <div className="grid gap-6 lg:grid-cols-2">
        <AttributionTable title="Plus de commandes attribuées" rows={byOrders} metric="orders" />
        <AttributionTable title="Plus de CA attribué" rows={byRevenue} metric="revenue" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <TenantNameList title="Tenants avec Pixel actif" rows={withPixel} empty="Aucun tenant n'a activé son Pixel." />
        <TenantNameList title="Tenants sans acquisition mesurable" rows={noAcquisition} empty="Tous les tenants ont au moins une commande attribuée." />
      </div>
    </div>
  );
}

function AttributionTable({ title, rows, metric }: { title: string; rows: SuperAdminAcquisitionTenantRow[]; metric: "orders" | "revenue" }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Commandes attribuées</th>
                <th className="px-4 py-3">CA attribué</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {rows.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={4}>
                    Aucune donnée pour ce filtre.
                  </td>
                </tr>
              )}
              {rows.map((row, index) => (
                <tr key={row.restaurant_id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                  <td className="px-4 py-3 font-medium">{row.restaurant_name}</td>
                  <td className={`px-4 py-3 ${metric === "orders" ? "font-semibold" : "text-slate-600"}`}>{row.attributed_orders.toLocaleString("fr-FR")}</td>
                  <td className={`px-4 py-3 ${metric === "revenue" ? "font-semibold" : "text-slate-600"}`}>{formatMoney(row.attributed_revenue, row.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TenantNameList({ title, rows, empty }: { title: string; rows: SuperAdminAcquisitionTenantRow[]; empty: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((row) => (
            <li key={row.restaurant_id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm">
              <span className="font-medium">{row.restaurant_name}</span>
              <span className="text-slate-500">{row.attributed_orders} commande(s) attribuée(s)</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

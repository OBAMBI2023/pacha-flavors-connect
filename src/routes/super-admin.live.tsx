import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Eye, Radio, Store, Users } from "lucide-react";
import { useSuperAdminPageViewOverview } from "@/hooks/useSuperAdminPageViewOverview";
import type { SuperAdminPageViewTenantRow } from "@/lib/superAdminPageViews";
import { SuperAdminKpiCard } from "@/components/superadmin/SuperAdminKpiCard";
import { PageViewsChart } from "@/components/superadmin/PageViewsChart";

export const Route = createFileRoute("/super-admin/live")({
  ssr: false,
  component: SuperAdminLivePage,
});

const PERIOD_OPTIONS = [
  { value: 1, label: "Aujourd'hui" },
  { value: 7, label: "7 derniers jours" },
  { value: 30, label: "30 derniers jours" },
];

const ACTIVITY_LIMIT = 10;

function SuperAdminLivePage() {
  const [periodDays, setPeriodDays] = useState(30);
  const { data, loading, error } = useSuperAdminPageViewOverview(periodDays);

  const tenants = data?.tenants ?? [];
  const noDataYet = !data && Boolean(error);

  // Ranking is already views_today desc, name asc from the RPC -- kept as-is.
  const ranking = tenants;

  // Activity feed: active tenants first, then the rest by today's views, capped so this reads
  // as a live feed rather than duplicating the full ranking table below it.
  const activity = useMemo(
    () =>
      [...tenants]
        .sort((a, b) => b.active_visitors_now - a.active_visitors_now || b.views_today - a.views_today)
        .slice(0, ACTIVITY_LIMIT),
    [tenants],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900 sm:text-3xl">SAOVIA Live</h1>
          <p className="mt-1 text-sm text-slate-600">Fréquentation des vitrines publiques, tous tenants confondus.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">● LIVE</span>
        </div>
      </div>

      {error && data && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SuperAdminKpiCard
          icon={Eye}
          label="Vues aujourd'hui"
          value={noDataYet ? "Non disponible" : (data?.total_views_today ?? 0).toLocaleString("fr-FR")}
        />
        <SuperAdminKpiCard
          icon={Users}
          label="Visiteurs uniques aujourd'hui"
          value={noDataYet ? "Non disponible" : (data?.unique_visitors_today ?? 0).toLocaleString("fr-FR")}
        />
        <SuperAdminKpiCard
          icon={Radio}
          label="Visiteurs actifs"
          value={noDataYet ? "Non disponible" : (data?.active_visitors_now ?? 0).toLocaleString("fr-FR")}
        />
        <SuperAdminKpiCard
          icon={Store}
          label="Tenants suivis"
          value={noDataYet ? "Non disponible" : tenants.length.toLocaleString("fr-FR")}
        />
      </div>

      {/* Activité temps réel */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Activité en temps réel</h2>
        <p className="mt-1 text-sm text-slate-500">Visiteurs actifs sur les 5 dernières minutes, par tenant.</p>
        <div className="mt-4 space-y-2">
          {loading && !data ? (
            <p className="text-sm text-slate-500">Chargement...</p>
          ) : activity.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun tenant suivi pour le moment.</p>
          ) : (
            activity.map((tenant) => <TenantActivityRow key={tenant.restaurant_id} tenant={tenant} />)
          )}
        </div>
      </div>

      {/* Classement */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Top tenants par vues aujourd'hui</h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Tenant</th>
                  <th className="px-4 py-3">Vues</th>
                  <th className="px-4 py-3">Visiteurs uniques</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {loading && !data ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={4}>
                      Chargement...
                    </td>
                  </tr>
                ) : ranking.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={4}>
                      Aucun tenant suivi pour le moment.
                    </td>
                  </tr>
                ) : (
                  ranking.map((tenant, index) => (
                    <tr key={tenant.restaurant_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                      <td className="px-4 py-3 font-medium">{tenant.restaurant_name}</td>
                      <td className="px-4 py-3 font-semibold">{tenant.views_today.toLocaleString("fr-FR")}</td>
                      <td className="px-4 py-3 text-slate-600">{tenant.unique_visitors_today.toLocaleString("fr-FR")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Graphique */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Évolution des vues</h2>
            <p className="mt-1 text-sm text-slate-500">Vues et visiteurs uniques par jour, tous tenants confondus.</p>
          </div>
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
        <div className="mt-4">
          {loading && !data ? <p className="text-sm text-slate-500">Chargement...</p> : <PageViewsChart data={data?.views_by_day ?? []} />}
        </div>
      </div>
    </div>
  );
}

function TenantActivityRow({ tenant }: { tenant: SuperAdminPageViewTenantRow }) {
  const active = tenant.active_visitors_now > 0;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 px-3 py-2">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        {tenant.logo_url ? (
          <img src={tenant.logo_url} alt={tenant.restaurant_name} className="h-full w-full object-contain" loading="lazy" />
        ) : (
          <span className="text-xs font-semibold text-slate-500">{tenant.restaurant_name.slice(0, 2).toUpperCase()}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{tenant.restaurant_name}</p>
        <p className="text-xs text-slate-500">{tenant.views_today.toLocaleString("fr-FR")} vue(s) aujourd'hui</p>
      </div>
      <span
        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
          active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
        }`}
      >
        {active ? `🟢 Actif (${tenant.active_visitors_now})` : "⚪ Aucun visiteur actif"}
      </span>
    </div>
  );
}

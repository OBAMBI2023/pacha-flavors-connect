import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Radio,
  Store,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { useSuperAdminPageViewOverview } from "@/hooks/useSuperAdminPageViewOverview";
import { useSuperAdminAvailabilityOverview } from "@/hooks/useSuperAdminAvailabilityOverview";
import type { SuperAdminPageViewTenantRow } from "@/lib/superAdminPageViews";
import {
  AVAILABILITY_STATUS_LABELS,
  AVAILABILITY_STATUS_STYLES,
  anomalyLabels,
  formatHours,
  formatRate,
  formatTimeInTimezone,
  type AvailabilityStatus,
  type SuperAdminAvailabilityRow,
} from "@/lib/superAdminAvailability";
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

type OperationalFilter = "all" | "open" | "closed" | "unexpected" | "paused";

const OPERATIONAL_FILTERS: {
  value: OperationalFilter;
  label: string;
  status: AvailabilityStatus | null;
}[] = [
  { value: "all", label: "Tous", status: null },
  { value: "open", label: "Ouverts", status: "OPEN" },
  { value: "closed", label: "Fermés (prévu)", status: "CLOSED_SCHEDULED" },
  { value: "unexpected", label: "Anomalies", status: "CLOSED_UNEXPECTED" },
  { value: "paused", label: "Pause volontaire", status: "PAUSED" },
];

function SuperAdminLivePage() {
  const [periodDays, setPeriodDays] = useState(30);
  const { data, loading, error } = useSuperAdminPageViewOverview(periodDays);
  const {
    data: availability,
    loading: availabilityLoading,
    error: availabilityError,
  } = useSuperAdminAvailabilityOverview();
  const [operationalFilter, setOperationalFilter] = useState<OperationalFilter>("all");

  const tenants = data?.tenants ?? [];
  const noDataYet = !data && Boolean(error);

  const availabilityRows = availability?.rows ?? [];
  const availabilityNoDataYet = !availability && Boolean(availabilityError);
  const restaurantsUnexpectedlyClosed = useMemo(
    () => availabilityRows.filter((row) => row.current_status === "CLOSED_UNEXPECTED").length,
    [availabilityRows],
  );
  const hasAnyMonitoringData = useMemo(
    () => availabilityRows.some((row) => row.has_monitoring_data),
    [availabilityRows],
  );
  const filteredAvailabilityRows = useMemo(() => {
    const targetStatus =
      OPERATIONAL_FILTERS.find((f) => f.value === operationalFilter)?.status ?? null;
    return targetStatus === null
      ? availabilityRows
      : availabilityRows.filter((row) => row.current_status === targetStatus);
  }, [availabilityRows, operationalFilter]);

  // Anomalies section: only tenants with at least one real, snapshot-derived anomaly --
  // anomalyLabels() already returns [] whenever has_monitoring_data is false, so this
  // list can never surface a "guessed" anomaly for a tenant with no monitoring history.
  const tenantsWithAnomalies = useMemo(
    () =>
      availabilityRows
        .map((row) => ({ row, labels: anomalyLabels(row) }))
        .filter((entry) => entry.labels.length > 0),
    [availabilityRows],
  );

  // Ranking is already views_today desc, name asc from the RPC -- kept as-is.
  const ranking = tenants;

  // Activity feed: active tenants first, then the rest by today's views, capped so this reads
  // as a live feed rather than duplicating the full ranking table below it.
  const activity = useMemo(
    () =>
      [...tenants]
        .sort(
          (a, b) => b.active_visitors_now - a.active_visitors_now || b.views_today - a.views_today,
        )
        .slice(0, ACTIVITY_LIMIT),
    [tenants],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900 sm:text-3xl">
            SAOVIA Live
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Fréquentation des vitrines publiques et disponibilité des restaurants, tous tenants
            confondus.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
            ● LIVE
          </span>
        </div>
      </div>

      {error && data && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Section: visitor_kpis */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SuperAdminKpiCard
          icon={Eye}
          label="Vues aujourd'hui"
          value={
            noDataYet ? "Non disponible" : (data?.total_views_today ?? 0).toLocaleString("fr-FR")
          }
        />
        <SuperAdminKpiCard
          icon={Users}
          label="Visiteurs uniques aujourd'hui"
          value={
            noDataYet
              ? "Non disponible"
              : (data?.unique_visitors_today ?? 0).toLocaleString("fr-FR")
          }
        />
        <SuperAdminKpiCard
          icon={Radio}
          label="Visiteurs actifs"
          value={
            noDataYet ? "Non disponible" : (data?.active_visitors_now ?? 0).toLocaleString("fr-FR")
          }
        />
        <SuperAdminKpiCard
          icon={Store}
          label="Tenants suivis"
          value={noDataYet ? "Non disponible" : tenants.length.toLocaleString("fr-FR")}
        />
      </div>

      {/* Section: operational_kpis */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Statut opérationnel</h2>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Ouverture réelle vs. horaires prévus, aujourd&apos;hui -- rafraîchi toutes les 15
          secondes.
        </p>

        {availabilityError && availability && (
          <p className="mt-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {availabilityError}
          </p>
        )}

        {!availabilityLoading && !availabilityNoDataYet && !hasAnyMonitoringData && (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Aucune donnée de surveillance réelle pour aujourd&apos;hui pour le moment -- les
              heures réelles, interruptions et taux de disponibilité resteront vides jusqu&apos;à ce
              que le suivi accumule assez d&apos;historique.
            </p>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <SuperAdminKpiCard
            icon={Store}
            label="Ouverts maintenant"
            value={
              availabilityNoDataYet
                ? "Non disponible"
                : (availability?.kpis.restaurants_open_now ?? 0).toLocaleString("fr-FR")
            }
          />
          <SuperAdminKpiCard
            icon={Store}
            label="Fermés maintenant"
            value={
              availabilityNoDataYet
                ? "Non disponible"
                : (availability?.kpis.restaurants_closed_now ?? 0).toLocaleString("fr-FR")
            }
          />
          <SuperAdminKpiCard
            icon={AlertTriangle}
            label="Fermés (anomalie)"
            value={
              availabilityNoDataYet
                ? "Non disponible"
                : restaurantsUnexpectedlyClosed.toLocaleString("fr-FR")
            }
          />
          <SuperAdminKpiCard
            icon={Clock}
            label="Heures prévues (jour)"
            value={
              availabilityNoDataYet
                ? "Non disponible"
                : formatHours(availability?.kpis.scheduled_hours ?? 0)
            }
          />
          <SuperAdminKpiCard
            icon={TrendingUp}
            label="Heures réelles (jour)"
            value={
              availabilityNoDataYet
                ? "Non disponible"
                : formatHours(availability?.kpis.actual_open_hours ?? null)
            }
          />
          <SuperAdminKpiCard
            icon={TrendingDown}
            label="Interruptions (jour)"
            value={
              availabilityNoDataYet
                ? "Non disponible"
                : formatHours(availability?.kpis.unexpected_downtime ?? null)
            }
          />
          <SuperAdminKpiCard
            icon={TrendingUp}
            label="Disponibilité moyenne"
            value={
              availabilityNoDataYet
                ? "Non disponible"
                : formatRate(availability?.kpis.average_availability_rate ?? null)
            }
          />
        </div>
      </div>

      {/* Section: live_restaurant_status */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Disponibilité par restaurant</h2>
        <p className="mt-1 text-sm text-slate-500">
          Statut en temps réel, tous tenants confondus -- aujourd&apos;hui.
        </p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {OPERATIONAL_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setOperationalFilter(f.value)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                operationalFilter === f.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Restaurant</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Ouverture</th>
                  <th className="px-4 py-3">Fermeture</th>
                  <th className="px-4 py-3">Heures prévues</th>
                  <th className="px-4 py-3">Heures réelles</th>
                  <th className="px-4 py-3">Interruptions</th>
                  <th className="px-4 py-3">Disponibilité</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {availabilityLoading && !availability ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={8}>
                      Chargement...
                    </td>
                  </tr>
                ) : filteredAvailabilityRows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={8}>
                      Aucun tenant pour ce filtre.
                    </td>
                  </tr>
                ) : (
                  filteredAvailabilityRows.map((row) => (
                    <tr key={row.restaurant_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{row.restaurant_name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${AVAILABILITY_STATUS_STYLES[row.current_status]}`}
                        >
                          {AVAILABILITY_STATUS_LABELS[row.current_status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatTimeInTimezone(row.opening_time, row.timezone)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatTimeInTimezone(row.closing_time, row.timezone)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatHours(row.scheduled_hours)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatHours(row.actual_open_hours)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatHours(row.unexpected_downtime_hours)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {formatRate(row.availability_rate)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Section: anomalies */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Anomalies détectées</h2>
        <p className="mt-1 text-sm text-slate-500">
          Fermetures inattendues, ouvertures/fermetures hors horaires, interruptions longues --
          uniquement pour les tenants avec des données de surveillance réelles.
        </p>
        <div className="mt-4 space-y-2">
          {availabilityLoading && !availability ? (
            <p className="text-sm text-slate-500">Chargement...</p>
          ) : tenantsWithAnomalies.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Aucune anomalie détectée pour le moment.
            </p>
          ) : (
            tenantsWithAnomalies.map(({ row, labels }) => (
              <AnomalyRow key={row.restaurant_id} row={row} labels={labels} />
            ))
          )}
        </div>
      </div>

      {/* Section: availability_summary */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Résumé de disponibilité</h2>
            <p className="mt-1 text-sm text-slate-500">
              {availabilityNoDataYet
                ? "Non disponible pour le moment."
                : `${(availability?.kpis.restaurants_open_now ?? 0).toLocaleString("fr-FR")} ouverts / ${(availability?.rows.length ?? 0).toLocaleString("fr-FR")} tenants -- disponibilité moyenne ${formatRate(availability?.kpis.average_availability_rate ?? null)} aujourd'hui.`}
            </p>
          </div>
          <Link
            to="/super-admin/availability"
            className="shrink-0 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            Voir le détail (7j / 30j) →
          </Link>
        </div>
      </div>

      {/* Activité temps réel */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Activité en temps réel</h2>
        <p className="mt-1 text-sm text-slate-500">
          Visiteurs actifs sur les 5 dernières minutes, par tenant.
        </p>
        <div className="mt-4 space-y-2">
          {loading && !data ? (
            <p className="text-sm text-slate-500">Chargement...</p>
          ) : activity.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun tenant suivi pour le moment.</p>
          ) : (
            activity.map((tenant) => (
              <TenantActivityRow key={tenant.restaurant_id} tenant={tenant} />
            ))
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
                      <td className="px-4 py-3 font-semibold">
                        {tenant.views_today.toLocaleString("fr-FR")}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {tenant.unique_visitors_today.toLocaleString("fr-FR")}
                      </td>
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
            <p className="mt-1 text-sm text-slate-500">
              Vues et visiteurs uniques par jour, tous tenants confondus.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PERIOD_OPTIONS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriodDays(p.value)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  periodDays === p.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4">
          {loading && !data ? (
            <p className="text-sm text-slate-500">Chargement...</p>
          ) : (
            <PageViewsChart data={data?.views_by_day ?? []} />
          )}
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
          <img
            src={tenant.logo_url}
            alt={tenant.restaurant_name}
            className="h-full w-full object-contain"
            loading="lazy"
          />
        ) : (
          <span className="text-xs font-semibold text-slate-500">
            {tenant.restaurant_name.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{tenant.restaurant_name}</p>
        <p className="text-xs text-slate-500">
          {tenant.views_today.toLocaleString("fr-FR")} vue(s) aujourd'hui
        </p>
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

function AnomalyRow({ row, labels }: { row: SuperAdminAvailabilityRow; labels: string[] }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-100 bg-amber-50/50 px-3 py-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-slate-900">{row.restaurant_name}</p>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${AVAILABILITY_STATUS_STYLES[row.current_status]}`}
          >
            {AVAILABILITY_STATUS_LABELS[row.current_status]}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {labels.map((label) => (
            <span
              key={label}
              className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[11px] font-normal text-amber-800"
            >
              <AlertTriangle className="h-3 w-3" />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

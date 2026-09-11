import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Clock, Store, TrendingDown, TrendingUp } from "lucide-react";
import {
  AVAILABILITY_STATUS_LABELS,
  AVAILABILITY_STATUS_STYLES,
  anomalyLabels,
  fetchSuperAdminAvailabilityOverview,
  formatHours,
  formatRate,
  formatTimeInTimezone,
  type AvailabilityStatus,
  type SuperAdminAvailabilityOverview,
} from "@/lib/superAdminAvailability";
import { SuperAdminKpiCard } from "@/components/superadmin/SuperAdminKpiCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/super-admin/availability")({
  ssr: false,
  component: SuperAdminAvailabilityPage,
});

const PERIOD_OPTIONS = [
  { value: 1, label: "Aujourd'hui" },
  { value: 7, label: "7 derniers jours" },
  { value: 30, label: "30 derniers jours" },
];

const EMPTY: SuperAdminAvailabilityOverview = {
  period_days: 1,
  rows: [],
  kpis: {
    restaurants_open_now: 0,
    restaurants_closed_now: 0,
    scheduled_hours: 0,
    actual_open_hours: null,
    unexpected_downtime: null,
    average_availability_rate: null,
  },
};

function SuperAdminAvailabilityPage() {
  const [periodDays, setPeriodDays] = useState(1);
  const [data, setData] = useState<SuperAdminAvailabilityOverview>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<AvailabilityStatus | "all">("all");
  const [tenantFilter, setTenantFilter] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchSuperAdminAvailabilityOverview(periodDays)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled)
          toast.error(
            err instanceof Error ? err.message : "Impossible de charger la disponibilité.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [periodDays]);

  const tenantOptions = useMemo(
    () => [...data.rows].sort((a, b) => a.restaurant_name.localeCompare(b.restaurant_name)),
    [data.rows],
  );

  const filteredRows = useMemo(
    () =>
      data.rows.filter(
        (row) =>
          (statusFilter === "all" || row.current_status === statusFilter) &&
          (tenantFilter === "all" || row.restaurant_id === tenantFilter),
      ),
    [data.rows, statusFilter, tenantFilter],
  );

  const anomalyCount = useMemo(
    () => data.rows.filter((row) => anomalyLabels(row).length > 0).length,
    [data.rows],
  );
  const hasAnyMonitoringData = useMemo(
    () => data.rows.some((row) => row.has_monitoring_data),
    [data.rows],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900 sm:text-3xl">
          Disponibilité & horaires
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Horaires prévus, ouverture réelle et interruptions -- tous tenants confondus, mesuré en
          temps réel.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
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

      {!loading && !hasAnyMonitoringData && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Aucune donnée de surveillance réelle pour cette période pour le moment -- les colonnes «
            heures réelles », « interruptions » et « taux de disponibilité » resteront vides
            jusqu&apos;à ce que le suivi (toutes les 5 minutes) accumule assez d&apos;historique.
            Les horaires prévus, eux, sont toujours fiables.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <SuperAdminKpiCard
          icon={Store}
          label="Ouverts maintenant"
          value={data.kpis.restaurants_open_now.toLocaleString("fr-FR")}
        />
        <SuperAdminKpiCard
          icon={Store}
          label="Fermés maintenant"
          value={data.kpis.restaurants_closed_now.toLocaleString("fr-FR")}
        />
        <SuperAdminKpiCard
          icon={Clock}
          label="Heures prévues"
          value={formatHours(data.kpis.scheduled_hours)}
        />
        <SuperAdminKpiCard
          icon={TrendingUp}
          label="Heures réelles ouvertes"
          value={formatHours(data.kpis.actual_open_hours)}
        />
        <SuperAdminKpiCard
          icon={TrendingDown}
          label="Interruptions imprévues"
          value={formatHours(data.kpis.unexpected_downtime)}
        />
        <SuperAdminKpiCard
          icon={TrendingUp}
          label="Taux de disponibilité moyen"
          value={formatRate(data.kpis.average_availability_rate)}
        />
      </div>

      {anomalyCount > 0 && (
        <p className="text-xs text-slate-500">
          {anomalyCount} tenant{anomalyCount > 1 ? "s" : ""} avec au moins une anomalie détectée sur
          la période.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as AvailabilityStatus | "all")}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {(Object.keys(AVAILABILITY_STATUS_LABELS) as AvailabilityStatus[]).map((status) => (
              <SelectItem key={status} value={status}>
                {AVAILABILITY_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={tenantFilter} onValueChange={setTenantFilter}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Tenant" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les tenants</SelectItem>
            {tenantOptions.map((row) => (
              <SelectItem key={row.restaurant_id} value={row.restaurant_id}>
                {row.restaurant_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-xs text-slate-400">
          {filteredRows.length} / {data.rows.length} tenant{data.rows.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
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
                {loading && (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={8}>
                      Chargement...
                    </td>
                  </tr>
                )}
                {!loading && filteredRows.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={8}>
                      Aucun tenant pour ce filtre.
                    </td>
                  </tr>
                )}
                {!loading &&
                  filteredRows.map((row) => {
                    const anomalies = anomalyLabels(row);
                    return (
                      <tr key={row.restaurant_id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium">
                          {row.restaurant_name}
                          {anomalies.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {anomalies.map((label) => (
                                <span
                                  key={label}
                                  className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-normal text-amber-700"
                                >
                                  <AlertTriangle className="h-3 w-3" />
                                  {label}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
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
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

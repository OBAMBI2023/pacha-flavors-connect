import { supabase } from "@/integrations/supabase/client";

/** Mirrors the status model computed by compute_availability_status() in 20260831060000_super_admin_availability_overview.sql. */
export type AvailabilityStatus =
  "OPEN" | "CLOSED_SCHEDULED" | "CLOSED_UNEXPECTED" | "PAUSED" | "UNKNOWN";

export type SuperAdminAvailabilityAnomalies = {
  closed_during_scheduled_hours: boolean;
  open_outside_scheduled_hours: boolean;
  late_opening: boolean;
  early_closing: boolean;
  long_unexpected_downtime: boolean;
};

export type SuperAdminAvailabilityRow = {
  restaurant_id: string;
  restaurant_name: string;
  timezone: string;
  current_status: AvailabilityStatus;
  is_open: boolean;
  /** Today's earliest scheduled opening instant, or null if closed today / unconfigured. */
  opening_time: string | null;
  /** Today's latest scheduled closing instant, or null if closed today / unconfigured. */
  closing_time: string | null;
  scheduled_hours_today: number;
  /** Scheduled hours across the whole selected period. */
  scheduled_hours: number;
  /** null when has_monitoring_data is false -- no real snapshot data for this period, never fabricated. */
  actual_open_hours: number | null;
  unexpected_downtime_hours: number | null;
  /** null when there's no scheduled time or no monitoring data to compute a rate from. */
  availability_rate: number | null;
  has_monitoring_data: boolean;
  anomalies: SuperAdminAvailabilityAnomalies;
};

export type SuperAdminAvailabilityKpis = {
  restaurants_open_now: number;
  restaurants_closed_now: number;
  scheduled_hours: number;
  actual_open_hours: number | null;
  unexpected_downtime: number | null;
  average_availability_rate: number | null;
};

export type SuperAdminAvailabilityOverview = {
  period_days: number;
  rows: SuperAdminAvailabilityRow[];
  kpis: SuperAdminAvailabilityKpis;
};

const EMPTY_RESULT: SuperAdminAvailabilityOverview = {
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

/**
 * Super Admin only, platform-wide -- get_super_admin_availability_overview()
 * re-checks is_super_admin() itself. Status/tenant filtering happens
 * client-side over the full row list (same convention as the acquisition
 * page's client-side top-N/filter lists); only the period is a server param.
 */
export async function fetchSuperAdminAvailabilityOverview(
  periodDays = 1,
): Promise<SuperAdminAvailabilityOverview> {
  const { data, error } = await supabase.rpc("get_super_admin_availability_overview", {
    p_period_days: periodDays,
  });
  if (error) throw error;
  return (data as unknown as SuperAdminAvailabilityOverview | null) ?? EMPTY_RESULT;
}

// ---------------------------------------------------------------------------
// Shared display helpers -- single source of truth for every page that
// renders SuperAdminAvailabilityRow (currently /super-admin/availability and
// the "Statut opérationnel" section of /super-admin/live).
// ---------------------------------------------------------------------------

export const AVAILABILITY_STATUS_LABELS: Record<AvailabilityStatus, string> = {
  OPEN: "Ouvert",
  CLOSED_SCHEDULED: "Fermé (prévu)",
  CLOSED_UNEXPECTED: "Fermé (anomalie)",
  PAUSED: "Pause volontaire",
  UNKNOWN: "Inconnu",
};

export const AVAILABILITY_STATUS_STYLES: Record<AvailabilityStatus, string> = {
  OPEN: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CLOSED_SCHEDULED: "border-slate-200 bg-slate-100 text-slate-600",
  CLOSED_UNEXPECTED: "border-destructive/20 bg-destructive/5 text-destructive",
  PAUSED: "border-amber-200 bg-amber-50 text-amber-700",
  UNKNOWN: "border-slate-200 bg-slate-100 text-slate-500",
};

/**
 * Always formatted in the restaurant's own timezone, never the viewer's --
 * same guarantee (and the same manual-pad-from-formatToParts technique) as
 * AvailabilityBadge.tsx's local formatTimeInTimezone.
 */
export function formatTimeInTimezone(iso: string | null, timeZone: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  function build(tz: string | undefined): string {
    const parts = new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: tz,
    }).formatToParts(date);
    const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
    const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
    return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
  }
  try {
    return build(timeZone);
  } catch {
    return build(undefined);
  }
}

/** null renders as "—" -- never a fabricated 0 for a tenant with no monitoring data yet. */
export function formatHours(hours: number | null): string {
  if (hours === null) return "—";
  return `${hours.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} h`;
}

/** null renders as "—" -- never a fabricated 0%/NaN when there's no scheduled time or no monitoring data. */
export function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${rate.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}%`;
}

const ANOMALY_LABELS: Record<keyof SuperAdminAvailabilityAnomalies, string> = {
  closed_during_scheduled_hours: "Fermé pendant les horaires prévus",
  open_outside_scheduled_hours: "Ouvert hors horaires prévus",
  late_opening: "Ouverture tardive",
  early_closing: "Fermeture anticipée",
  long_unexpected_downtime: "Longue interruption",
};

/** [] whenever has_monitoring_data is false -- anomalies are only ever real, snapshot-derived findings, never guessed. */
export function anomalyLabels(row: SuperAdminAvailabilityRow): string[] {
  if (!row.has_monitoring_data) return [];
  return (Object.keys(ANOMALY_LABELS) as (keyof SuperAdminAvailabilityAnomalies)[])
    .filter((key) => row.anomalies[key])
    .map((key) => ANOMALY_LABELS[key]);
}

import type { DateRange } from "@/lib/marketing";

export type CrmPeriodPreset = "today" | "7d" | "30d" | "90d" | "custom";

export const CRM_PERIOD_LABELS: Record<CrmPeriodPreset, string> = {
  today: "Aujourd'hui",
  "7d": "7 derniers jours",
  "30d": "30 derniers jours",
  "90d": "90 derniers jours",
  custom: "Période personnalisée",
};

export const CRM_PERIOD_PRESETS: CrmPeriodPreset[] = ["today", "7d", "30d", "90d", "custom"];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function resolveCrmPeriod(preset: CrmPeriodPreset, custom?: DateRange): DateRange {
  const now = new Date();
  switch (preset) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "7d":
      return { start: startOfDay(addDays(now, -6)), end: endOfDay(now) };
    case "30d":
      return { start: startOfDay(addDays(now, -29)), end: endOfDay(now) };
    case "90d":
      return { start: startOfDay(addDays(now, -89)), end: endOfDay(now) };
    case "custom":
      return custom ?? { start: startOfDay(addDays(now, -29)), end: endOfDay(now) };
  }
}

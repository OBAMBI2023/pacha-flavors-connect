export type PeriodPreset = "today" | "yesterday" | "last7" | "last30" | "thisMonth" | "lastMonth" | "custom";

export type PeriodRange = { start: Date; end: Date };

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  today: "Aujourd'hui",
  yesterday: "Hier",
  last7: "7 derniers jours",
  last30: "30 derniers jours",
  thisMonth: "Mois courant",
  lastMonth: "Mois précédent",
  custom: "Période personnalisée",
};

export const PERIOD_PRESETS: PeriodPreset[] = ["today", "yesterday", "last7", "last30", "thisMonth", "lastMonth", "custom"];

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

export function resolvePeriod(preset: PeriodPreset, custom?: PeriodRange): PeriodRange {
  const now = new Date();
  switch (preset) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "yesterday": {
      const y = addDays(now, -1);
      return { start: startOfDay(y), end: endOfDay(y) };
    }
    case "last7":
      return { start: startOfDay(addDays(now, -6)), end: endOfDay(now) };
    case "last30":
      return { start: startOfDay(addDays(now, -29)), end: endOfDay(now) };
    case "thisMonth":
      return { start: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)), end: endOfDay(now) };
    case "lastMonth": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: startOfDay(start), end: endOfDay(end) };
    }
    case "custom":
      return custom ?? { start: startOfDay(now), end: endOfDay(now) };
  }
}

import { useCallback, useEffect, useState } from "react";
import { fetchDashboardStats, type DashboardStats } from "@/lib/orders-db";
import type { PeriodRange } from "@/components/admin/stats/periodPresets";

export function useDashboardStats(period: PeriodRange) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const start = period.start.getTime();
  const end = period.end.getTime();

  const refresh = useCallback(() => {
    setLoading(true);
    setError("");
    fetchDashboardStats(new Date(start), new Date(end))
      .then(setStats)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Impossible de charger les statistiques."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { stats, loading, error, refresh };
}

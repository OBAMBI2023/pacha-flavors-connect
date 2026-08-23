import { useEffect, useState } from "react";
import { fetchVisitorRealtimeCount, fetchVisitorStats, type VisitorStats } from "@/lib/visitors-db";
import { StatCard } from "@/components/admin/stats/StatCard";

const REALTIME_REFRESH_MS = 10_000;

export function VisitorsPanel() {
  const [realtimeCount, setRealtimeCount] = useState<number | null>(null);
  const [stats, setStats] = useState<VisitorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Realtime count polls every 10s (matches the "En ligne maintenant" spec);
  // the today/7-day/30-day aggregates aren't nearly as time-sensitive, so
  // they're only fetched once per panel visit rather than on the same timer
  // -- polling those every 10s would be a lot of avoidable load for numbers
  // that barely change minute to minute.
  useEffect(() => {
    let cancelled = false;

    async function loadRealtime() {
      try {
        const count = await fetchVisitorRealtimeCount();
        if (!cancelled) setRealtimeCount(count);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Impossible de charger les visiteurs en ligne.");
      }
    }

    void loadRealtime();
    const interval = window.setInterval(() => void loadRealtime(), REALTIME_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchVisitorStats()
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Impossible de charger les statistiques de visite.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold">Visiteurs</h2>
        <p className="text-sm text-muted-foreground">Suivez la fréquentation de votre restaurant.</p>
      </div>

      {error && <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">En temps réel</span>
        </div>
        <p className="mt-3 text-sm font-medium text-muted-foreground">En ligne maintenant</p>
        <p className="mt-1 font-display text-4xl font-bold text-foreground">
          {realtimeCount === null ? "—" : realtimeCount} <span className="text-lg font-medium text-muted-foreground">visiteur{realtimeCount !== 1 ? "s" : ""}</span>
        </p>
      </section>

      {loading && !stats ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Chargement des statistiques...</p>
      ) : stats ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Aujourd'hui" value={String(stats.today)} />
          <StatCard label="7 derniers jours" value={String(stats.week)} />
          <StatCard label="30 derniers jours" value={String(stats.month)} />
        </div>
      ) : null}
    </div>
  );
}

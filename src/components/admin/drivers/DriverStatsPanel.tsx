import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DRIVER_STATUS_BUCKET_CLASSNAMES, DRIVER_STATUS_BUCKET_LABELS, driverStatusBucket, fetchDriverFleetStats, type DriverFleetStats } from "@/lib/drivers";

type Period = "today" | "7d" | "30d" | "month" | "custom";

const PERIODS: { value: Period; label: string }[] = [
  { value: "today", label: "Aujourd'hui" },
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "month", label: "Ce mois" },
  { value: "custom", label: "Personnalisé" },
];

function rangeFor(period: Period, customStart: string, customEnd: string): [Date, Date] {
  const now = new Date();
  if (period === "today") return [now, now];
  if (period === "7d") return [new Date(now.getTime() - 6 * 86_400_000), now];
  if (period === "30d") return [new Date(now.getTime() - 29 * 86_400_000), now];
  if (period === "month") return [new Date(now.getFullYear(), now.getMonth(), 1), now];
  return [customStart ? new Date(customStart) : now, customEnd ? new Date(customEnd) : now];
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}

export function DriverStatsPanel({ restaurantId }: { restaurantId: string }) {
  const [period, setPeriod] = useState<Period>("7d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [stats, setStats] = useState<DriverFleetStats | null>(null);
  const [loading, setLoading] = useState(true);

  const [start, end] = useMemo(() => rangeFor(period, customStart, customEnd), [period, customStart, customEnd]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDriverFleetStats(start, end)
      .then((data) => { if (!cancelled) setStats(data); })
      .catch((err: unknown) => { if (!cancelled) toast.error(err instanceof Error ? err.message : "Impossible de charger les statistiques."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [restaurantId, start, end]);

  const totals = stats?.period_totals;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold">Statistiques</h2>
        <p className="mt-1 text-sm text-muted-foreground">Performance globale de la flotte et détail par livreur.</p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPeriod(p.value)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              period === p.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {period === "custom" && (
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-auto" />
          <span className="text-sm text-muted-foreground">au</span>
          <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-auto" />
        </div>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Chargement...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Total livraisons" value={totals?.total_deliveries ?? 0} />
            <Kpi label="Terminées" value={totals?.completed ?? 0} />
            <Kpi label="Annulées" value={totals?.cancelled ?? 0} />
            <Kpi label="En cours" value={totals?.in_progress ?? 0} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Kpi label="Temps moyen de livraison" value={totals?.avg_delivery_minutes != null ? `${totals.avg_delivery_minutes} min` : "—"} />
            <Kpi label="Taux de réussite" value={totals?.success_rate != null ? `${totals.success_rate}%` : "—"} />
          </div>

          <div className="hidden overflow-x-auto rounded-2xl border border-border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Livreur</th>
                  <th className="px-4 py-3 text-left">Statut</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Terminées</th>
                  <th className="px-4 py-3 text-right">Annulées</th>
                  <th className="px-4 py-3 text-right">Aujourd'hui</th>
                  <th className="px-4 py-3 text-right">Temps moyen</th>
                  <th className="px-4 py-3 text-right">Taux de réussite</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.by_driver ?? []).map((d) => {
                  const bucket = driverStatusBucket(d.status);
                  return (
                    <tr key={d.driver_id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">{d.full_name}</td>
                      <td className="px-4 py-3"><Badge className={DRIVER_STATUS_BUCKET_CLASSNAMES[bucket]}>{DRIVER_STATUS_BUCKET_LABELS[bucket]}</Badge></td>
                      <td className="px-4 py-3 text-right">{d.total_deliveries}</td>
                      <td className="px-4 py-3 text-right">{d.completed}</td>
                      <td className="px-4 py-3 text-right">{d.cancelled}</td>
                      <td className="px-4 py-3 text-right">{d.today}</td>
                      <td className="px-4 py-3 text-right">{d.avg_delivery_minutes != null ? `${d.avg_delivery_minutes} min` : "—"}</td>
                      <td className="px-4 py-3 text-right">{d.success_rate != null ? `${d.success_rate}%` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-2.5 md:hidden">
            {(stats?.by_driver ?? []).map((d) => {
              const bucket = driverStatusBucket(d.status);
              return (
                <div key={d.driver_id} className="rounded-2xl border border-border bg-card p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{d.full_name}</p>
                    <Badge className={DRIVER_STATUS_BUCKET_CLASSNAMES[bucket]}>{DRIVER_STATUS_BUCKET_LABELS[bucket]}</Badge>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {d.total_deliveries} livraisons · {d.completed} terminées · {d.success_rate != null ? `${d.success_rate}%` : "—"} de réussite
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

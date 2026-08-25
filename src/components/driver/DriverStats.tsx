import { Skeleton } from "@/components/ui/skeleton";

export type DriverStatsData = {
  coursesToday: number;
  coursesCompletedToday: number;
  acceptanceRatePct: number | null;
};

/** Every number here is computed by livreur.tsx from a direct, RLS-scoped query the driver is already allowed to run (orders where assigned_driver_id = auth.uid(), delivery_proposals where driver_id = auth.uid()) -- never a placeholder. acceptanceRatePct is null (not 0) when there's no proposal history yet to compute a rate from, rendered as "--" rather than a fabricated 0%. */
export function DriverStats({ data, loading }: { data: DriverStatsData | null; loading: boolean }) {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    );
  }

  const items = [
    { label: "Courses aujourd'hui", value: String(data.coursesToday) },
    { label: "Terminées", value: String(data.coursesCompletedToday) },
    { label: "Taux d'acceptation", value: data.acceptanceRatePct === null ? "--" : `${data.acceptanceRatePct}%` },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl bg-card p-3 text-center shadow-sm">
          <p className="font-display text-2xl font-bold text-foreground">{item.value}</p>
          <p className="mt-1 text-[0.65rem] leading-tight text-muted-foreground">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

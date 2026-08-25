import type { DriverProfile } from "@/lib/delivery";

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0]![0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

const STATUS_LABELS: Record<DriverProfile["status"], string> = {
  offline: "Hors ligne",
  available: "Disponible",
  proposed: "Proposition en attente",
  busy: "Occupé",
  delivering: "En livraison",
};

/** Only fields that genuinely exist on driver_profiles and are readable via driver_profiles_select_own -- no rating/review figure shown since nothing in this schema computes one for a driver today. */
export function DriverProfileCard({ driver }: { driver: DriverProfile }) {
  return (
    <div className="flex items-center gap-4 rounded-3xl bg-card p-5 shadow-sm">
      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-primary/10 text-lg font-bold text-primary">
        {initials(driver.full_name)}
      </div>
      <div>
        <p className="font-display text-lg font-semibold">{driver.full_name}</p>
        <p className="text-sm text-muted-foreground">{driver.phone}</p>
        <span className="mt-1 inline-block rounded-full bg-secondary/60 px-2.5 py-0.5 text-xs font-semibold text-foreground">
          {STATUS_LABELS[driver.status]}
        </span>
      </div>
    </div>
  );
}

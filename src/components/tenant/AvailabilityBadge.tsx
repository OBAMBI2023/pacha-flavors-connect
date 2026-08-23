import type { RestaurantAvailability } from "@/lib/businessHours";

/** Always formatted in the restaurant's own configured timezone, never the viewer's browser timezone. */
function formatTimeInTimezone(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  }
}

export function AvailabilityBadge({
  availability,
  timezone,
  className = "",
}: {
  availability: RestaurantAvailability | null;
  timezone: string;
  className?: string;
}) {
  if (!availability) return null;

  const detail = availability.is_open
    ? availability.closes_at
      ? `Ferme à ${formatTimeInTimezone(availability.closes_at, timezone)}`
      : null
    : availability.next_opens_at
      ? `Prochaine ouverture : ${formatTimeInTimezone(availability.next_opens_at, timezone)}`
      : null;

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${
        availability.is_open ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-destructive/20 bg-destructive/5 text-destructive"
      } ${className}`}
    >
      <span>{availability.is_open ? "🟢 Ouvert" : "🔴 Fermé"}</span>
      {detail && <span className="text-xs font-normal text-muted-foreground">{detail}</span>}
    </div>
  );
}

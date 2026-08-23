import { useEffect, useState } from "react";
import type { RestaurantAvailability } from "@/lib/businessHours";

/**
 * Always formatted in the restaurant's own configured timezone, never the
 * viewer's browser timezone. Built from `formatToParts` and manually padded
 * rather than trusting the locale's own rendered string -- guarantees a
 * literal "HH:MM" with no risk of a stray/missing digit or separator.
 */
function formatTimeInTimezone(iso: string, timeZone: string): string {
  function build(tz: string | undefined): string {
    const parts = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz }).formatToParts(
      new Date(iso),
    );
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

const ONE_HOUR_SECONDS = 3600;

/**
 * "1h 00" is only reachable at the exact 3600s instant (the caller only ever
 * renders a countdown once <=3600s remain), then "XX min" down to the
 * minute, then "XX sec" under a minute.
 */
function formatCountdown(secondsRemaining: number): string {
  if (secondsRemaining >= ONE_HOUR_SECONDS) {
    const hours = Math.floor(secondsRemaining / 3600);
    const minutes = Math.floor((secondsRemaining % 3600) / 60);
    return `${hours}h ${String(minutes).padStart(2, "0")}`;
  }
  if (secondsRemaining >= 60) {
    return `${Math.floor(secondsRemaining / 60)} min`;
  }
  return `${secondsRemaining} sec`;
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
  // Only ticks while a real closing time is actually approaching. Purely a
  // local, display-only countdown derived from the server-provided
  // closes_at -- create_order remains the sole authority on whether an
  // order is actually accepted, this never feeds back into that decision.
  const closesAt = availability?.is_open ? availability.closes_at : null;
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(() =>
    closesAt ? Math.round((new Date(closesAt).getTime() - Date.now()) / 1000) : null,
  );

  useEffect(() => {
    if (!closesAt) {
      setSecondsRemaining(null);
      return;
    }
    const closesAtMs = new Date(closesAt).getTime();
    function tick() {
      setSecondsRemaining(Math.round((closesAtMs - Date.now()) / 1000));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [closesAt]);

  if (!availability) return null;

  const withinLastHour = closesAt !== null && secondsRemaining !== null && secondsRemaining > 0 && secondsRemaining <= ONE_HOUR_SECONDS;
  // The instant the local countdown reaches zero, show closed without
  // waiting on the next server refetch of `availability` -- cosmetic only.
  const justClosed = availability.is_open && secondsRemaining !== null && secondsRemaining <= 0;
  const isOpen = availability.is_open && !justClosed;

  // Stays on one line via flex-wrap when there's room; only breaks onto a
  // second line when the container is too narrow to fit both segments --
  // never truncated/clipped either way (max-w-full + break-words below).
  return (
    <div
      className={`inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 rounded-2xl border px-3 py-1.5 text-sm font-semibold ${
        isOpen ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-destructive/20 bg-destructive/5 text-destructive"
      } ${className}`}
    >
      <span className="whitespace-nowrap">{isOpen ? "🟢 Ouvert" : "🔴 Fermé"}</span>
      {isOpen && withinLastHour && (
        <span className="max-w-full whitespace-normal break-words text-xs font-normal leading-snug text-muted-foreground">
          · Ferme à {formatTimeInTimezone(closesAt, timezone)} · Ferme dans {formatCountdown(secondsRemaining)}
        </span>
      )}
      {!isOpen && availability.next_opens_at && (
        <span className="max-w-full whitespace-normal break-words text-xs font-normal leading-snug text-muted-foreground">
          Prochaine ouverture : {formatTimeInTimezone(availability.next_opens_at, timezone)}
        </span>
      )}
    </div>
  );
}

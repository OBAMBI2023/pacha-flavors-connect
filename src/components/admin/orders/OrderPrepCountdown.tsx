import { useEffect, useState } from "react";
import { AlarmClock, AlertTriangle } from "lucide-react";

/**
 * Purely a local, display-only countdown. The target ready time is derived
 * every render from two already-persisted order columns -- preparing_at
 * (written by the update_order_status RPC the instant a restaurant accepts
 * an order into preparation, see
 * supabase/migrations/20260820193148_phase1_orders_foundation.sql) and
 * estimated_preparation_minutes (computed at order creation from the
 * ordered dishes' own prep time, see
 * supabase/migrations/20260828020000_product_preparation_time.sql) -- never
 * a value stored just for this countdown. That's what makes a page refresh
 * safe: the target is recomputed identically from the same two persisted
 * timestamps/durations every time, mirroring
 * src/components/tenant/AvailabilityBadge.tsx's tick pattern. No Supabase
 * request is made by this component, ever.
 */
function computeTargetMs(preparingAt: string | null, estimatedPreparationMinutes: number | null): number | null {
  if (!preparingAt || estimatedPreparationMinutes === null) return null;
  return new Date(preparingAt).getTime() + estimatedPreparationMinutes * 60_000;
}

/** "24:35", "1:02:08" past 59:59, "00:00" at/under zero. */
function formatMmSs(totalSeconds: number): string {
  const abs = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(abs / 3600);
  const minutes = Math.floor((abs % 3600) / 60);
  const seconds = abs % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function OrderPrepCountdown({
  preparingAt,
  estimatedPreparationMinutes,
}: {
  preparingAt: string | null;
  estimatedPreparationMinutes: number | null;
}) {
  const targetMs = computeTargetMs(preparingAt, estimatedPreparationMinutes);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(() =>
    targetMs !== null ? Math.round((targetMs - Date.now()) / 1000) : null,
  );

  useEffect(() => {
    if (targetMs === null) {
      setSecondsRemaining(null);
      return;
    }
    function tick() {
      setSecondsRemaining(Math.round((targetMs! - Date.now()) / 1000));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  if (targetMs === null || secondsRemaining === null) return null;

  const elapsed = secondsRemaining <= 0;

  return (
    <p
      className={`flex items-center gap-1.5 truncate text-sm font-semibold ${
        elapsed ? "text-destructive" : "text-amber-700"
      }`}
    >
      {elapsed ? (
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <AlarmClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      )}
      {elapsed
        ? `Temps de préparation écoulé · +${formatMmSs(-secondsRemaining)}`
        : `Prêt dans ${formatMmSs(secondsRemaining)}`}
    </p>
  );
}

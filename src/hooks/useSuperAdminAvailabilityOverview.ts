import { useEffect, useState } from "react";
import {
  fetchSuperAdminAvailabilityOverview,
  type SuperAdminAvailabilityOverview,
} from "@/lib/superAdminAvailability";

const POLL_MS = 15_000;

/**
 * restaurant_availability_snapshots (like visitor_sessions/driver_profiles
 * before it) isn't in the realtime publication and has zero RLS grants for
 * any role -- same situation, same fix as useSuperAdminPageViewOverview /
 * useSuperAdminDriverLocations: poll the SECURITY DEFINER RPC on a moderate
 * interval instead of a direct table subscription. Fixed to "today"
 * (periodDays=1) -- this hook backs the Live page's real-time operational
 * status section, not the period-filterable /super-admin/availability page.
 */
export function useSuperAdminAvailabilityOverview(): {
  data: SuperAdminAvailabilityOverview | null;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<SuperAdminAvailabilityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    async function load() {
      try {
        const result = await fetchSuperAdminAvailabilityOverview(1);
        if (cancelled) return;
        setData(result);
        setError(null);
      } catch (err) {
        // Transient poll failure -- keep showing the last known numbers rather than
        // clearing the dashboard; only surfaces as an error if there's nothing yet.
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Impossible de charger le statut opérationnel.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    // Backgrounded tab stops polling entirely and refetches immediately on
    // return -- same fix as useSuperAdminDriverLocations.
    function start() {
      if (timer !== null) return;
      void load();
      timer = window.setInterval(() => void load(), POLL_MS);
    }

    function stop() {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) stop();
      else start();
    }

    setLoading(true);
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return { data, loading, error };
}

import { useEffect, useState } from "react";
import { fetchSuperAdminDriverLocations, type SuperAdminDriverLocation } from "@/lib/superAdminDriverLocations";

const POLL_MS = 12_000;

/**
 * Cross-tenant driver_profiles has no super-admin RLS grant (by design, see
 * the Step 3 migration) so a direct `postgres_changes` subscription would
 * receive nothing for this role -- short-interval polling of the same
 * SECURITY DEFINER RPC used for the initial load is the "stratégie serveur
 * sécurisée" fallback instead, never a direct table subscription.
 */
export function useSuperAdminDriverLocations(restaurantId: string | null): {
  drivers: SuperAdminDriverLocation[];
  loading: boolean;
} {
  const [drivers, setDrivers] = useState<SuperAdminDriverLocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    async function load() {
      try {
        const rows = await fetchSuperAdminDriverLocations(restaurantId);
        if (!cancelled) setDrivers(rows);
      } catch {
        // Transient poll failure -- keep showing the last known positions
        // rather than clearing the map.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    // Backgrounded tab stops polling entirely (a forgotten super-admin tab
    // was generating a 12s RPC every tick indefinitely) and refetches
    // immediately on return so the map isn't stale when the tab comes back.
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
  }, [restaurantId]);

  return { drivers, loading };
}

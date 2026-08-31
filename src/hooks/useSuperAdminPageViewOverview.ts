import { useEffect, useState } from "react";
import { fetchSuperAdminPageViewOverview, type SuperAdminPageViewOverview } from "@/lib/superAdminPageViews";

const POLL_MS = 15_000;

/**
 * visitor_sessions isn't in the supabase_realtime publication (only `orders` is) and has zero
 * RLS policies for any role -- a super-admin `postgres_changes` subscription would receive
 * nothing even if added. Same situation and same fix as useSuperAdminDriverLocations
 * (src/hooks/useSuperAdminDriverLocations.ts): poll the SECURITY DEFINER RPC on a moderate
 * interval instead of a direct table subscription. This only ever reads -- no heartbeat, no
 * write; the heartbeat belongs to the visitor (src/lib/visitorTracking.ts), never the dashboard.
 */
export function useSuperAdminPageViewOverview(periodDays: number): {
  data: SuperAdminPageViewOverview | null;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<SuperAdminPageViewOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await fetchSuperAdminPageViewOverview(periodDays);
        if (cancelled) return;
        setData(result);
        setError(null);
      } catch (err) {
        // Transient poll failure -- keep showing the last known numbers rather than
        // clearing the dashboard; only surfaces as an error if there's nothing yet.
        if (!cancelled) setError(err instanceof Error ? err.message : "Impossible de charger les données Live.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    setLoading(true);
    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [periodDays]);

  return { data, loading, error };
}

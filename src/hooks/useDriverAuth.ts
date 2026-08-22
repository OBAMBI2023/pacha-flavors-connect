import { useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { fetchOwnDriverProfile, type DriverProfile } from "@/lib/delivery";

export function useDriverAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDriver() {
      const userId = session?.user?.id;
      if (!userId) {
        setDriver(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const row = await fetchOwnDriverProfile(userId).catch(() => null);
      if (cancelled) return;
      setDriver(row);
      setLoading(false);
    }

    void loadDriver();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const user: User | null = session?.user ?? null;

  return useMemo(
    () => ({
      session,
      user,
      loading,
      driver,
      isDriver: driver !== null,
      restaurantId: driver?.restaurant_id ?? null,
    }),
    [driver, loading, session, user],
  );
}

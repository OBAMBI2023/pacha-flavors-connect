import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchDriverPosition } from "@/lib/delivery";
import type { RealtimeConnectionState } from "@/hooks/useRealtimeOrders";

export type DriverLivePosition = { lat: number; lng: number };

/**
 * Tenant-side live read of one driver's position. Mirrors useDriverProposals'
 * shape: no-ops cleanly on `driverId === null`, one realtime channel per
 * mount, filtered to exactly this driver (never all drivers), fully torn
 * down on unmount -- callers are expected to only pass a non-null driverId
 * while a tracking UI is actually open, which is what scopes the
 * subscription to "only while the modal is open" by construction.
 */
export function useDriverLiveLocation(driverId: string | null): {
  position: DriverLivePosition | null;
  lastLocationAt: string | null;
  connectionStatus: RealtimeConnectionState;
  loading: boolean;
} {
  const [position, setPosition] = useState<DriverLivePosition | null>(null);
  const [lastLocationAt, setLastLocationAt] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionState>("connecting");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (id: string) => {
    const row = await fetchDriverPosition(id);
    setPosition(row.lat != null && row.lng != null ? { lat: row.lat, lng: row.lng } : null);
    setLastLocationAt(row.last_location_at);
  }, []);

  useEffect(() => {
    if (!driverId) {
      setPosition(null);
      setLastLocationAt(null);
      setConnectionStatus("connecting");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setConnectionStatus("connecting");

    const channel = supabase
      .channel(`driver-location-${driverId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "driver_profiles", filter: `id=eq.${driverId}` },
        () => void refresh(driverId),
      )
      .subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") setConnectionStatus("connected");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setConnectionStatus("error");
        else if (status === "CLOSED") setConnectionStatus("disconnected");
      });

    refresh(driverId).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [driverId, refresh]);

  return { position, lastLocationAt, connectionStatus, loading };
}

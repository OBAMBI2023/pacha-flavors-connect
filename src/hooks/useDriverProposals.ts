import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchDriverActiveDelivery,
  fetchDriverPendingProposal,
  type DriverActiveDelivery,
  type DriverPendingProposal,
} from "@/lib/delivery";

/**
 * Realtime here is purely a "something changed, refetch" signal -- the
 * actual data always comes back through the curated RPCs
 * (get_driver_pending_proposal / get_driver_active_delivery), never from the
 * postgres_changes payload itself, so there's no risk of a stale/partial
 * row being rendered as if it were the full curated shape.
 */
export function useDriverProposals(driverId: string | null) {
  const [pendingProposal, setPendingProposal] = useState<DriverPendingProposal | null>(null);
  const [activeDelivery, setActiveDelivery] = useState<DriverActiveDelivery | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!driverId) return;
    const [proposal, delivery] = await Promise.all([fetchDriverPendingProposal(), fetchDriverActiveDelivery()]);
    setPendingProposal(proposal);
    setActiveDelivery(delivery);
  }, [driverId]);

  useEffect(() => {
    if (!driverId) {
      setPendingProposal(null);
      setActiveDelivery(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    const channel = supabase
      .channel(`driver-proposals-${driverId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delivery_proposals", filter: `driver_id=eq.${driverId}` },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `assigned_driver_id=eq.${driverId}` },
        () => void refresh(),
      )
      .subscribe();

    refresh().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [driverId, refresh]);

  return { pendingProposal, activeDelivery, loading, refresh };
}

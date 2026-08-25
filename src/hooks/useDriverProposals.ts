import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchDriverActiveDelivery,
  fetchDriverPendingProposal,
  type DriverActiveDelivery,
  type DriverPendingProposal,
} from "@/lib/delivery";
import { partnerConnectionManager, type PartnerConnectionState } from "@/partner-runtime";

function devLog(message: string): void {
  if (import.meta.env.DEV) console.info(`[SAOVIA_RUNTIME] ${message}`);
}

/**
 * Realtime here is purely a "something changed, refetch" signal -- the
 * actual data always comes back through the curated RPCs
 * (get_driver_pending_proposal / get_driver_active_delivery), never from the
 * postgres_changes payload itself, so there's no risk of a stale/partial
 * row being rendered as if it were the full curated shape.
 *
 * Phase 4: still exactly one channel, still the same two filtered
 * postgres_changes listeners (delivery_proposals.driver_id=eq / orders
 * .assigned_driver_id=eq, both backed by matching RLS policies --
 * delivery_proposals_select_driver_own / orders_select_assigned_driver --
 * so isolation holds even if a filter were ever wrong). Two additions,
 * both observational: dev-only event logs, and a catch-up refresh() when
 * partnerConnectionManager (Phase 2) reports a *recovery* from a drop --
 * not on the initial connect, which the mount-time refresh() below already
 * covers. No second subscription, no independent reconnect/backoff loop --
 * ConnectionManager remains the only thing that owns retry timing.
 */
export function useDriverProposals(driverId: string | null) {
  const [pendingProposal, setPendingProposal] = useState<DriverPendingProposal | null>(null);
  const [activeDelivery, setActiveDelivery] = useState<DriverActiveDelivery | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!driverId) return;
    const [proposal, delivery] = await Promise.all([
      fetchDriverPendingProposal(),
      fetchDriverActiveDelivery(),
    ]);
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
        {
          event: "*",
          schema: "public",
          table: "delivery_proposals",
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          devLog(`proposal-event=${payload.eventType}`);
          void refresh();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `assigned_driver_id=eq.${driverId}`,
        },
        () => {
          devLog("assignment-event=order-update");
          void refresh();
        },
      )
      .subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") devLog("realtime=connected");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
          devLog(`realtime=error status=${status}`);
        else if (status === "CLOSED") devLog("realtime=disconnected");
      });

    refresh().finally(() => {
      if (!cancelled) setLoading(false);
    });

    // Catch-up fetch on genuine recovery only (RECONNECTING -> CONNECTED),
    // not on the initial connect -- the refresh() call above already covers
    // that. Guards against anything missed while the shared socket (and
    // therefore this channel) was down. Purely reactive: no timer, no
    // second subscription, no retry loop of its own.
    let previousConnectionState: PartnerConnectionState = partnerConnectionManager.getState();
    const unsubscribeConnection = partnerConnectionManager.subscribe(({ state }) => {
      if (cancelled) return;
      if (state === "CONNECTED" && previousConnectionState === "RECONNECTING") {
        devLog("realtime=connected (resumed after reconnect)");
        void refresh();
      }
      previousConnectionState = state;
    });

    return () => {
      cancelled = true;
      unsubscribeConnection();
      void supabase.removeChannel(channel);
    };
  }, [driverId, refresh]);

  return { pendingProposal, activeDelivery, loading, refresh };
}

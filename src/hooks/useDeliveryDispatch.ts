import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchActiveProposalsForRestaurant, type DispatchProposalWithDriver } from "@/lib/delivery";

/**
 * Tenant-side view of dispatch: the latest pending/accepted proposal per
 * order, keyed by order_id, so OrderCard can show "Livreur proposé (nom,
 * distance)" / "Livreur assigné (nom)" without a per-card query. Same
 * parallel fetch+subscribe pattern as useRealtimeOrders/useNotifications.
 */
export function useDeliveryDispatch(restaurantId: string | null) {
  const [byOrderId, setByOrderId] = useState<Map<string, DispatchProposalWithDriver>>(new Map());

  useEffect(() => {
    if (!restaurantId) {
      setByOrderId(new Map());
      return;
    }
    let cancelled = false;

    async function load() {
      if (!restaurantId) return;
      const rows = await fetchActiveProposalsForRestaurant(restaurantId).catch(() => []);
      if (cancelled) return;
      const map = new Map<string, DispatchProposalWithDriver>();
      // Rows arrive newest-first; keep only the first (latest) row per order.
      for (const row of rows) {
        if (!map.has(row.order_id)) map.set(row.order_id, row);
      }
      setByOrderId(map);
    }

    const channel = supabase
      .channel(`delivery-dispatch-${restaurantId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delivery_proposals", filter: `restaurant_id=eq.${restaurantId}` },
        () => void load(),
      )
      .subscribe();

    void load();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  return byOrderId;
}

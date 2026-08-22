import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useRealtimeOrders, type RealtimeConnectionState } from "@/hooks/useRealtimeOrders";
import type { Order, OrderStatus } from "@/lib/orders-db";
import {
  getSoundPreference,
  playNewOrderChime,
  preloadOrderAudio,
  setAutoplayBlockedListener,
  setSoundPreference,
  stopOrderChime,
  unlockOrderAudio,
} from "@/lib/order-audio";

/**
 * Lives at the admin route level (not inside the Commandes tab panel) so the
 * realtime subscription and the chime keep running no matter which tab the
 * tenant is looking at -- Radix Tabs unmounts inactive tab content, and a
 * "persistent until accepted/refused" alert must survive that.
 *
 * The chime's only stop condition is `pendingCount` reaching 0: it does not
 * care whether an order has been opened/viewed, and it restarts on mount if
 * a pending order is already there (a page refresh must not silence it).
 */
export function useOrdersAlert(restaurantId: string | null, options?: { onViewOrder?: (orderId: string) => void }) {
  const [soundEnabled, setSoundEnabledState] = useState(false);
  const onViewOrderRef = useRef(options?.onViewOrder);
  onViewOrderRef.current = options?.onViewOrder;

  useEffect(() => {
    setSoundEnabledState(getSoundPreference());
    // Fetch the chime file as soon as the dashboard mounts, whether or not
    // sound is currently enabled -- so the first real alert never has to
    // wait on a network fetch.
    preloadOrderAudio();
    setAutoplayBlockedListener(() => {
      toast.warning("Le son des commandes est bloqué par le navigateur", {
        id: "order-sound-autoplay-blocked",
        description: "Cliquez sur « Activer les alertes sonores » pour l'autoriser.",
        duration: 8_000,
      });
    });
    return () => setAutoplayBlockedListener(null);
  }, []);

  const onNewOrder = useCallback((order: Order) => {
    const onViewOrder = onViewOrderRef.current;
    toast(`Nouvelle commande #${order.order_number}`, {
      description: `${order.customer_name} · ${order.total_amount.toLocaleString("fr-FR")} ${order.currency}`,
      duration: 10_000,
      action: onViewOrder ? { label: "Voir", onClick: () => onViewOrder(order.id) } : undefined,
    });
  }, []);

  const { orders, connectionState, newOrderIds, acknowledgeOrder, patchOrder, loading } = useRealtimeOrders(
    restaurantId,
    onNewOrder,
  );

  const pendingCount = useMemo(() => orders.filter((o) => o.status === "pending").length, [orders]);

  useEffect(() => {
    if (pendingCount > 0) playNewOrderChime();
    else stopOrderChime();
  }, [pendingCount]);

  // This hook only lives while the tenant is inside /admin (it sits above
  // the tabs precisely so tab switches don't unmount it); if /admin itself
  // unmounts there is no surface left to accept/refuse the order from, so
  // the chime must not keep looping unattended.
  useEffect(() => {
    return () => stopOrderChime();
  }, []);

  async function enableSound() {
    await unlockOrderAudio();
    setSoundPreference(true);
    setSoundEnabledState(true);
  }

  function disableSound() {
    setSoundPreference(false);
    setSoundEnabledState(false);
    stopOrderChime();
  }

  return {
    orders,
    connectionState,
    newOrderIds,
    acknowledgeOrder,
    patchOrder,
    loading,
    pendingCount,
    soundEnabled,
    enableSound,
    disableSound,
  };
}

export type OrdersAlert = ReturnType<typeof useOrdersAlert>;
export type { RealtimeConnectionState, OrderStatus };

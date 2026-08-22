import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchOrderItemsSummary, fetchRestaurantOrders, type Order } from "@/lib/orders-db";

export type RealtimeConnectionState = "connecting" | "connected" | "disconnected" | "error";

function byCreatedDesc(a: Order, b: Order) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

/**
 * Tenant-scoped live order feed for the dashboard. Subscribes to
 * postgres_changes on `orders` filtered to this restaurant only -- Realtime
 * is defense-in-depth here, not the security boundary: RLS
 * (orders_select_members) is what actually stops a socket from ever
 * receiving another tenant's rows even if the filter were wrong.
 *
 * The channel is opened and the initial REST fetch kicked off in parallel
 * (not fetch-then-subscribe) so an order created in that short window is
 * never silently missed; the fetch merges into, rather than overwrites, any
 * rows Realtime already delivered while it was in flight.
 */
export function useRealtimeOrders(
  restaurantId: string | null,
  onNewOrder?: (order: Order) => void,
) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>("connecting");
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const ordersMapRef = useRef<Map<string, Order>>(new Map());
  const onNewOrderRef = useRef(onNewOrder);
  onNewOrderRef.current = onNewOrder;

  const acknowledgeOrder = useCallback((orderId: string) => {
    setNewOrderIds((prev) => {
      if (!prev.has(orderId)) return prev;
      const next = new Set(prev);
      next.delete(orderId);
      return next;
    });
  }, []);

  const applyOrder = useCallback((row: Order) => {
    ordersMapRef.current.set(row.id, row);
    setOrders(Array.from(ordersMapRef.current.values()).sort(byCreatedDesc));
  }, []);

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    ordersMapRef.current = new Map();
    setOrders([]);
    setNewOrderIds(new Set());
    setLoading(true);
    setConnectionState("connecting");

    // The topic includes a per-mount random suffix -- `supabase.channel(topic)`
    // returns the *same* channel object for a topic still being torn down
    // (removeChannel below is async and not awaited), so a fast
    // unmount+remount with an identical topic (React 18 double-invokes
    // effects in dev) hands back an already-`subscribe()`d channel and the
    // `.on()` calls below throw. A unique topic per effect run guarantees a
    // fresh, never-subscribed channel every time.
    const channel = supabase
      .channel(`orders-${restaurantId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` },
        (payload) => {
          const row = payload.new as Order;
          if (ordersMapRef.current.has(row.id)) return;
          applyOrder(row);
          setNewOrderIds((prev) => new Set(prev).add(row.id));
          onNewOrderRef.current?.(row);
          // The INSERT payload has no joined rows -- back-fill product names
          // for the dashboard card once order_items has actually been written.
          void fetchOrderItemsSummary(row.id).then((items_summary) => {
            if (cancelled) return;
            const current = ordersMapRef.current.get(row.id);
            if (current) applyOrder({ ...current, items_summary });
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` },
        (payload) => {
          applyOrder(payload.new as Order);
        },
      )
      .subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") setConnectionState("connected");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setConnectionState("error");
        else if (status === "CLOSED") setConnectionState("disconnected");
      });

    fetchRestaurantOrders(restaurantId)
      .then((initial) => {
        if (cancelled) return;
        for (const row of initial) {
          if (!ordersMapRef.current.has(row.id)) ordersMapRef.current.set(row.id, row);
        }
        setOrders(Array.from(ordersMapRef.current.values()).sort(byCreatedDesc));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [restaurantId, applyOrder]);

  const patchOrder = useCallback((orderId: string, patch: Partial<Order>) => {
    const current = ordersMapRef.current.get(orderId);
    if (!current) return;
    applyOrder({ ...current, ...patch });
  }, [applyOrder]);

  return { orders, connectionState, newOrderIds, acknowledgeOrder, patchOrder, loading };
}

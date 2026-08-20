import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/orders-db";

/**
 * Tenant-scoped in-app notification feed. Same parallel fetch+subscribe
 * pattern as useRealtimeOrders: the channel opens and the initial REST fetch
 * runs together so a notification created in that short window is never
 * missed, and RLS (notifications_select_members) is the real security
 * boundary -- the channel filter is defense-in-depth only.
 */
export function useNotifications(restaurantId: string | null) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    seenIds.current = new Set();
    setLoading(true);

    const channel = supabase
      .channel(`notifications-${restaurantId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `restaurant_id=eq.${restaurantId}` },
        (payload) => {
          const row = payload.new as AppNotification;
          if (seenIds.current.has(row.id)) return;
          seenIds.current.add(row.id);
          setNotifications((prev) => [row, ...prev].slice(0, 30));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `restaurant_id=eq.${restaurantId}` },
        (payload) => {
          const row = payload.new as AppNotification;
          setNotifications((prev) => prev.map((n) => (n.id === row.id ? row : n)));
        },
      )
      .subscribe();

    fetchNotifications(restaurantId)
      .then((initial) => {
        if (cancelled) return;
        for (const row of initial) seenIds.current.add(row.id);
        setNotifications(initial);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await markNotificationRead(id);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!restaurantId) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await markAllNotificationsRead(restaurantId);
  }, [restaurantId]);

  return { notifications, unreadCount, loading, markRead, markAllRead };
}

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-any";
import { getOrCreateVisitorId } from "@/lib/visitorTracking";

export type ClientNotificationType = "order_confirmed" | "order_status_update" | "delivery_update" | "new_offer";

export type ClientNotification = {
  id: string;
  type: ClientNotificationType;
  title: string;
  body: string | null;
  link_type: "order" | "offer" | null;
  link_id: string | null;
  is_read: boolean;
  created_at: string;
};

export async function fetchClientNotifications(slug: string, visitorId: string | null): Promise<ClientNotification[]> {
  if (!visitorId) return [];
  const { data, error } = await supabase.rpc("get_client_notifications", { p_slug: slug, p_visitor_id: visitorId });
  if (error) throw error;
  return (data as unknown as ClientNotification[] | null) ?? [];
}

export async function fetchUnreadClientNotificationsCount(slug: string, visitorId: string | null): Promise<number> {
  if (!visitorId) return 0;
  const { data, error } = await supabase.rpc("get_unread_client_notifications_count", { p_slug: slug, p_visitor_id: visitorId });
  if (error) throw error;
  return (data as number | null) ?? 0;
}

/** Order-lifecycle notifications only -- an offer notification's read state lives on offer_recipients and is flipped by markOfferRead (see offers.ts), reusing the same event to refresh this badge too. */
export async function markClientNotificationRead(notificationId: string, visitorId: string | null): Promise<void> {
  if (!visitorId) return;
  const { error } = await supabase.rpc("mark_client_notification_read", { p_notification_id: notificationId, p_visitor_id: visitorId });
  if (error) console.warn("[client-notifications]", error.message);
}

const NOTIFICATIONS_READ_EVENT = "saovia:client-notifications-read";

export function notifyClientNotificationRead() {
  window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT));
}

export function useUnreadClientNotificationsCount(slug: string | null | undefined): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!slug) return;
    const restaurantSlug = slug;
    let cancelled = false;
    function refresh() {
      const visitorId = getOrCreateVisitorId();
      fetchUnreadClientNotificationsCount(restaurantSlug, visitorId)
        .then((n) => { if (!cancelled) setCount(n); })
        .catch((err: unknown) => console.warn("[client-notifications]", err instanceof Error ? err.message : err));
    }
    refresh();
    window.addEventListener(NOTIFICATIONS_READ_EVENT, refresh);
    window.addEventListener("saovia:offers-read", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(NOTIFICATIONS_READ_EVENT, refresh);
      window.removeEventListener("saovia:offers-read", refresh);
    };
  }, [slug]);

  return count;
}

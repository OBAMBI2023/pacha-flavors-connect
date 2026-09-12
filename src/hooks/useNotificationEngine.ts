import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  subscribeToForegroundNotifications,
  type NotificationEventPayload,
} from "@/lib/notifications";

/**
 * Foreground half of the notification engine ("Supabase Realtime pour les
 * mises à jour instantanées dans l'application ouverte"). The backgrounded/
 * closed half is Web Push, delivered straight to the Service Worker
 * (public/sw-push.js) -- this hook never touches that path.
 *
 * Duplicate suppression is symmetric with sw-push.js's own focused-client
 * check: that check skips showNotification() when a focused tab exists (this
 * hook is what such a tab is running), so a toast here is never followed by
 * a redundant system notification for the exact same event on the same
 * device. A backgrounded tab that still receives this broadcast (rare --
 * Realtime sockets do stay open when hidden) just gets a toast nobody's
 * looking at; harmless, and still deduplicated against push by
 * notification_events.id doubling as the push `tag`.
 *
 * Reconnection (network loss/regain, tab visibility, session expiry) is not
 * hand-rolled here: supabase-js's Realtime client already reconnects its
 * websocket on its own, and this effect's dependency on identity means a
 * login/logout (session expiring or a new one starting) tears down the old
 * channel and opens the correct one for the new identity automatically.
 */
export function useNotificationEngine(identity: {
  userId: string | null;
  visitorId: string | null;
}) {
  const [unreadCount, setUnreadCount] = useState(0);
  const seenEventIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!identity.userId && !identity.visitorId) return;

    const unsubscribe = subscribeToForegroundNotifications(
      identity,
      (payload: NotificationEventPayload) => {
        if (seenEventIds.current.has(payload.event_id)) return;
        seenEventIds.current.add(payload.event_id);

        setUnreadCount((count) => count + 1);
        toast(payload.title, {
          description: payload.body,
          action: payload.url
            ? {
                label: "Voir",
                onClick: () => {
                  window.location.href = payload.url as string;
                },
              }
            : undefined,
        });
      },
    );

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the primitive ids, not the `identity` object itself: callers pass a fresh object literal every render, so depending on it would resubscribe on every render instead of only when the actual identity changes.
  }, [identity.userId, identity.visitorId]);

  return { unreadCount, clearUnreadCount: () => setUnreadCount(0) };
}

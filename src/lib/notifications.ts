import { supabase } from "@/integrations/supabase/client";
import { isPushSupported, getVapidPublicKey, urlBase64ToUint8Array } from "@/lib/push";
import { getOrCreateVisitorId } from "@/lib/visitorTracking";

export { isPushSupported };

export type NotificationEventPayload = {
  event_id: string;
  type: string;
  title: string;
  body: string;
  url: string | null;
};

/**
 * Web Push subscribe/unsubscribe for the general notification engine
 * (customer order-tracking + any other authenticated user) -- src/lib/push.ts
 * stays exactly as-is for the driver-specific flow it already serves.
 * Identity is resolved server-side by register_push_subscription itself
 * (auth.uid() when a session exists, otherwise the visitor_id passed here);
 * this function never decides which one applies, matching the "ne jamais
 * faire confiance à ce que le navigateur envoie" rule for anything that
 * actually gates access.
 */
export async function subscribeToNotifications(): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  const vapidKey = getVapidPublicKey();
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };
  if (!vapidKey) return { ok: false, reason: "not_configured" };

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    });
  }

  const json = subscription.toJSON();
  const p256dh = json.keys?.["p256dh"];
  const auth = json.keys?.["auth"];
  if (!json.endpoint || !p256dh || !auth) {
    return { ok: false, reason: "incomplete_subscription" };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const isAuthenticated = Boolean(sessionData.session?.user);
  const visitorId = isAuthenticated ? null : getOrCreateVisitorId();
  if (!isAuthenticated && !visitorId) return { ok: false, reason: "no_identity" };

  const { error } = await supabase.rpc("register_push_subscription", {
    p_endpoint: json.endpoint,
    p_p256dh: p256dh,
    p_auth: auth,
    p_platform: detectPlatform(),
    p_browser: detectBrowser(),
    ...(visitorId ? { p_visitor_id: visitorId } : {}),
  });
  if (error) return { ok: false, reason: error.message };

  return { ok: true };
}

export async function unsubscribeFromNotifications(): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  const { data: sessionData } = await supabase.auth.getSession();
  const isAuthenticated = Boolean(sessionData.session?.user);
  const visitorId = isAuthenticated ? null : getOrCreateVisitorId();
  await supabase.rpc("unregister_push_subscription", {
    p_endpoint: endpoint,
    ...(visitorId ? { p_visitor_id: visitorId } : {}),
  });
}

/** Coarse, non-fingerprinting classification -- only ever informs support/debugging (push_subscriptions.platform/browser), never used for any access decision. */
function detectPlatform(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Windows/.test(ua)) return "windows";
  if (/Macintosh/.test(ua)) return "macos";
  return "unknown";
}

function detectBrowser(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return "edge";
  if (/Chrome\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "safari";
  if (/Firefox\//.test(ua)) return "firefox";
  return "unknown";
}

/**
 * Foreground channel for the current identity (authenticated user OR
 * anonymous visitor) -- mirrors exactly what send-notification broadcasts
 * to (`notif:user:{id}` / `notif:visitor:{id}`). Returns an unsubscribe
 * function; safe to call with neither id (no-ops).
 */
export function subscribeToForegroundNotifications(
  identity: { userId: string | null; visitorId: string | null },
  onNotification: (payload: NotificationEventPayload) => void,
): () => void {
  const channelName = identity.userId
    ? `notif:user:${identity.userId}`
    : identity.visitorId
      ? `notif:visitor:${identity.visitorId}`
      : null;
  if (!channelName) return () => {};

  const channel = supabase
    .channel(channelName)
    .on("broadcast", { event: "notification" }, ({ payload }) => {
      onNotification(payload as NotificationEventPayload);
    })
    .subscribe();

  return () => void supabase.removeChannel(channel);
}

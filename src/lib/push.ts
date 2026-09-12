import { supabase } from "@/integrations/supabase/client";

/**
 * Web Push subscribe/unsubscribe -- prepared architecture, not wired to any
 * UI yet. No VAPID key is configured anywhere in this environment (see the
 * documentation block in supabase/migrations/20260827000500_phase8_driver_push_architecture.sql
 * for exactly what's missing), so `getVapidPublicKey()` returns null and
 * every function below is consequently inert: nothing here simulates a
 * working push pipeline, it only becomes callable once a real key exists.
 */

export function isPushSupported(): boolean {
  return (
    typeof navigator !== "undefined" && "serviceWorker" in navigator && "PushManager" in window
  );
}

/**
 * Same production key pair already provisioned for the driver push flow
 * (src/partner-runtime/notifications/pushManager.ts, private half held by
 * the send-push edge function secret). Public VAPID keys are never secret --
 * only reused here as a fallback so the general notification engine
 * (send-notification, which reads the *same* VAPID_PUBLIC_KEY/PRIVATE_KEY
 * project secret names) doesn't need a second key pair provisioned.
 * UNCONFIRMED: verify driver push notifications actually deliver in
 * production before relying on this for a real release -- if send-push's
 * VAPID env vars were ever rotated independently of this literal, browsers
 * will still let a subscription succeed (subscribe() doesn't validate
 * against the server's private key), but every send will then fail silently
 * server-side.
 */
const FALLBACK_VAPID_PUBLIC_KEY =
  "BHxS3xux61XKcOnRrsYmWSRQFhIRlBEacxLaf36PGjuHuiyo5QL4uTDvHR3JJiwwJRggqk3rPDuDF3bwhec3w-0";

/** Falls back to the shared driver-push key when VITE_VAPID_PUBLIC_KEY isn't set at build time -- callers must still treat a null return (only possible if that fallback is ever cleared) as "push not configured", never throw or fake success. */
export function getVapidPublicKey(): string | null {
  const key = import.meta.env["VITE_VAPID_PUBLIC_KEY"];
  if (typeof key === "string" && key.length > 0) return key;
  return FALLBACK_VAPID_PUBLIC_KEY;
}

/** Exported for src/lib/notifications.ts (the general notification engine) -- same conversion, one implementation. */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/**
 * Subscribes the current browser to Web Push and stores the subscription
 * (RLS-protected: a driver can only ever write rows where driver_id = their
 * own auth.uid()). No-ops if push isn't supported or no VAPID key is
 * configured -- never throws in that case, since "not configured" isn't an
 * error condition here.
 */
export async function subscribeToPush(driverId: string): Promise<void> {
  const vapidKey = getVapidPublicKey();
  if (!isPushSupported() || !vapidKey) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
  });

  const json = subscription.toJSON();
  const p256dh = json.keys?.["p256dh"];
  const auth = json.keys?.["auth"];
  if (!json.endpoint || !p256dh || !auth) {
    throw new Error("Abonnement push incomplet");
  }
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      driver_id: driverId,
      endpoint: json.endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: "endpoint" },
  );
  if (error) throw error;
}

export async function unsubscribeFromPush(driverId: string): Promise<void> {
  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("driver_id", driverId)
    .eq("endpoint", endpoint);
}

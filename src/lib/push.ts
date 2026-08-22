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
  return typeof navigator !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

/** Returns null when unset -- callers must treat that as "push not configured", never throw or fake success. */
export function getVapidPublicKey(): string | null {
  const key = import.meta.env["VITE_VAPID_PUBLIC_KEY"];
  return typeof key === "string" && key.length > 0 ? key : null;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
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
    { driver_id: driverId, endpoint: json.endpoint, p256dh, auth, user_agent: navigator.userAgent },
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
  await supabase.from("push_subscriptions").delete().eq("driver_id", driverId).eq("endpoint", endpoint);
}

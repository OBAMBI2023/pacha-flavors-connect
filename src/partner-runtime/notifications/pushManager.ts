import { supabase } from "@/lib/supabase-any";
import type { PushSubscriptionState } from "@/partner-runtime/notifications/notificationTypes";

/**
 * Public VAPID key -- not a secret, it's meant to ship to every browser (the
 * matching private key never leaves the send-push edge function's
 * environment). Production key pair generated and provisioned as of Phase 5.
 */
const VAPID_PUBLIC_KEY =
  "BHxS3xux61XKcOnRrsYmWSRQFhIRlBEacxLaf36PGjuHuiyo5QL4uTDvHR3JJiwwJRggqk3rPDuDF3bwhec3w-0";

function devLog(message: string): void {
  if (import.meta.env.DEV) console.info(`[SAOVIA_RUNTIME] ${message}`);
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function isSupported(): boolean {
  return (
    "serviceWorker" in navigator && "PushManager" in window && typeof Notification !== "undefined"
  );
}

/**
 * Registers (or reuses) a push subscription and upserts it for this driver.
 * Never requests Notification permission itself -- the caller (livreur.tsx's
 * "Devenir disponible" toggle) already owns that per Phase 3/5's rule that
 * permission is only ever requested from that one explicit action.
 */
export async function subscribe(driverId: string): Promise<PushSubscriptionState> {
  if (!isSupported()) return "unsupported";
  if (Notification.permission !== "granted") return "denied";

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });
  }

  const json = subscription.toJSON();
  const keys = json.keys;
  if (!json.endpoint || !keys?.["p256dh"] || !keys?.["auth"]) return "unsubscribed";

  // push_subscriptions is a pre-existing table (migration
  // phase8_driver_push_architecture, predates this Phase 5 work and this
  // repo's local migrations folder -- confirmed against the live schema
  // before writing this). Its real columns are exactly id, driver_id,
  // endpoint, p256dh, auth, user_agent, created_at -- no updated_at, and its
  // only unique constraint is on endpoint alone, not (driver_id, endpoint).
  // `as any` matches the existing convention already used elsewhere in this
  // repo for tables that predate the last generated Database types (see
  // admin.tsx).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see comment above
  const { error } = await supabase.from("push_subscriptions" as any).upsert(
    {
      driver_id: driverId,
      endpoint: json.endpoint,
      p256dh: keys["p256dh"],
      auth: keys["auth"],
      user_agent: navigator.userAgent,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- push_subscriptions predates the last generated Database types; narrows back to a real type once types.ts is regenerated.
    } as any,
    { onConflict: "endpoint" },
  );

  if (error) {
    devLog(`push-subscribe=error ${error.message}`);
    return "unsubscribed";
  }

  devLog("push-subscribe=success");
  return "subscribed";
}

export async function unsubscribe(driverId: string): Promise<void> {
  if (!isSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- push_subscriptions predates the last generated Database types.
    .from("push_subscriptions" as any)
    .delete()
    .eq("driver_id", driverId)
    .eq("endpoint", endpoint);
  devLog("push-unsubscribe=success");
}

export async function getSubscription(): Promise<PushSubscription | null> {
  if (!isSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

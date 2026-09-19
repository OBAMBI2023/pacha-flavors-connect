import { supabase } from "@/integrations/supabase/client";

// Auto-registers this native app's FCM token against the authenticated
// user via register_fcm_token (see
// supabase/migrations/20260919120000_fcm_device_tokens.sql for the table
// and RPCs, and supabase/functions/send-notification/fcm.ts for the send
// side). Native-only (Capacitor.isNativePlatform()) -- a no-op on the web,
// where Web Push (src/lib/notifications.ts, src/lib/push.ts) already
// covers browser push. Supersedes the earlier diagnostic-only
// native-push-diagnostics.tsx (console-logged the token, never registered
// it) -- keeping both mounted would double-register on every auth event.

let started = false;
let registeredToken: string | null = null;
let registeredForUserId: string | null = null;

/** Best-effort device label from the WebView's own user agent (e.g. "TECNO KM7k") -- optional field, never blocks registration if unavailable. */
function detectDeviceName(): string | undefined {
  try {
    const match = /Linux;\s*(?:Android\s*[\d.]+;\s*)?([^;)]+?)\s+Build\//.exec(navigator.userAgent);
    return match?.[1]?.trim() || undefined;
  } catch {
    return undefined;
  }
}

async function registerToken(token: string, userId: string): Promise<void> {
  // Idempotent: an auth event firing again for the same session (e.g.
  // TOKEN_REFRESHED) with a token we already registered for this same user
  // must not re-hit the RPC.
  if (registeredToken === token && registeredForUserId === userId) return;

  const deviceName = detectDeviceName();
  const { error } = await supabase.rpc("register_fcm_token", {
    p_token: token,
    p_platform: "android",
    ...(deviceName ? { p_device_name: deviceName } : {}),
  });
  if (error) {
    console.error("[native-push] register_fcm_token failed:", error.message);
    return;
  }
  registeredToken = token;
  registeredForUserId = userId;
  console.log("[native-push] FCM token registered");
}

async function unregisterCurrentToken(): Promise<void> {
  if (!registeredToken) return;
  const token = registeredToken;
  registeredToken = null;
  registeredForUserId = null;
  const { error } = await supabase.rpc("unregister_fcm_token", { p_token: token });
  if (error) console.error("[native-push] unregister_fcm_token failed:", error.message);
  else console.log("[native-push] FCM token unregistered");
}

/** Call once (idempotent past the first call) from the app root. */
export function initNativePush(): void {
  if (started) return;
  started = true;

  (async () => {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;

    const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");

    async function registerForUser(userId: string): Promise<void> {
      const permission = await FirebaseMessaging.checkPermissions();
      const granted =
        permission.receive === "granted"
          ? true
          : (await FirebaseMessaging.requestPermissions()).receive === "granted";
      if (!granted) {
        console.log("[native-push] notification permission denied");
        return;
      }
      const { token } = await FirebaseMessaging.getToken();
      await registerToken(token, userId);
    }

    // Fires once immediately with whatever session already exists
    // (INITIAL_SESSION), then again on every future sign-in/out/refresh --
    // covers "attendre la session" and "réagir aux changements" in one
    // listener, no separate getSession() bootstrap needed.
    supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user?.id ?? null;
      if (!userId) {
        void unregisterCurrentToken();
        return;
      }
      void registerForUser(userId).catch((error) => {
        console.error("[native-push] registration failed:", error);
      });
    });

    // Token rotation: re-register the new token against whoever is
    // currently signed in, if anyone.
    const listener = await FirebaseMessaging.addListener("tokenReceived", (event) => {
      void (async () => {
        const { data } = await supabase.auth.getSession();
        const userId = data.session?.user?.id ?? null;
        if (!userId) return;
        await registerToken(event.token, userId);
      })().catch((error) => {
        console.error("[native-push] token refresh handling failed:", error);
      });
    });
    void listener; // kept alive for the app's lifetime, same as the auth listener above
  })().catch((error) => {
    console.error("[native-push] init failed:", error);
  });
}

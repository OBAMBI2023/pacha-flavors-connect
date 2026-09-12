import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { timingSafeEqual } from "node:crypto";
import webpush from "npm:web-push@3";

// Generalized sibling of send-push (which stays exactly as-is for
// delivery_proposals): delivers a notification_events row to Web Push
// subscriptions AND broadcasts it over Realtime for whichever tab already
// has the app open, so the foreground toast and the OS push both come from
// this one send instead of two divergent code paths. Invoked exclusively
// from public.enqueue_notification() (orders/delivery_proposals triggers),
// never called directly by any client -- verify_jwt=false at the gateway
// (no user JWT exists inside a DB trigger), auth gate 1 below instead.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:support@saovia.app";
const TRIGGER_SECRET = Deno.env.get("NOTIFICATION_TRIGGER_SECRET");

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

type SendNotificationPayload = {
  event_id?: string;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Same constant-time-compare rationale as send-push's safeCompare -- see that file for the full explanation. */
function safeCompare(a: string, b: string): boolean {
  const bufA = new TextEncoder().encode(a);
  const bufB = new TextEncoder().encode(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Gate 1: no valid shared secret, no processing at all -- same reasoning
  // as send-push (closes "unauthenticated direct call can re-trigger a
  // notification for a known event id").
  if (!TRIGGER_SECRET) {
    return json({ error: "Server misconfigured." }, 500);
  }
  const providedSecret = req.headers.get("x-notification-secret");
  if (!providedSecret || !safeCompare(providedSecret, TRIGGER_SECRET)) {
    return json({ error: "Unauthorized" }, 401);
  }

  let payload: SendNotificationPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Corps de requête JSON invalide." }, 400);
  }

  if (!payload.event_id) {
    return json({ error: "event_id requis." }, 400);
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Gate 2, re-validated against the DB even though the caller is now
  // authenticated -- defense in depth, and the only place this reads what
  // to actually send (never trusts anything beyond the event_id from the
  // request itself).
  const { data: event } = await adminClient
    .from("notification_events")
    .select("id, user_id, visitor_id, type, title, body, url, status")
    .eq("id", payload.event_id)
    .eq("status", "pending")
    .maybeSingle();

  if (!event) {
    return json({ skipped: true, reason: "event_not_found_or_not_pending" });
  }
  if (!event.user_id && !event.visitor_id) {
    await adminClient.from("notification_events").update({ status: "skipped" }).eq("id", event.id);
    return json({ skipped: true, reason: "no_recipient" });
  }

  // Minimal payload only -- exactly what sw-push.js already knows how to
  // render (title/body/tag/url), plus `type` so it can apply the NEW_ORDER
  // vibration pattern without carrying any extra data for every other event
  // type. `tag` = event_id, so a redelivered/duplicate push is coalesced by
  // the OS with whatever's already showing, same as delivery_proposals' push.
  const pushPayload = JSON.stringify({
    title: event.title,
    body: event.body,
    url: event.url ?? "/",
    tag: event.id,
    type: event.type,
  });

  // Realtime broadcast first (near-instant for a foreground tab) -- the
  // channel name doubles as the capability, same trust model this app
  // already uses for visitor_id everywhere else (get_client_notifications
  // et al. -- knowing the id is what grants access, there being no session
  // to scope a channel-level RLS policy to for an anonymous visitor).
  const channelName = event.user_id
    ? `notif:user:${event.user_id}`
    : `notif:visitor:${event.visitor_id}`;
  try {
    const channel = adminClient.channel(channelName);
    await channel.subscribe();
    await channel.send({
      type: "broadcast",
      event: "notification",
      payload: {
        event_id: event.id,
        type: event.type,
        title: event.title,
        body: event.body,
        url: event.url,
      },
    });
    await adminClient.removeChannel(channel);
  } catch {
    // Realtime is a best-effort foreground convenience, never the only
    // delivery path -- Web Push below is what actually matters.
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    await adminClient.from("notification_events").update({ status: "skipped" }).eq("id", event.id);
    return json({ skipped: true, reason: "vapid_not_configured" });
  }

  let subsQuery = adminClient
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("is_active", true);
  subsQuery = event.user_id
    ? subsQuery.eq("user_id", event.user_id)
    : subsQuery.eq("visitor_id", event.visitor_id);
  const { data: subs } = await subsQuery;

  if (!subs || subs.length === 0) {
    await adminClient
      .from("notification_events")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", event.id);
    return json({ sent: 0, reason: "no_push_subscription" });
  }

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        pushPayload,
      ),
    ),
  );

  // Same cleanup rule as send-push: a 404/410 means that endpoint is
  // permanently gone -- deactivate rather than delete, per the "désactiver
  // automatiquement une subscription expirée/invalide" requirement (send-push
  // deletes outright for the older driver-only table; this generalized
  // engine keeps the row around, inactive, for last_seen_at/audit purposes).
  await Promise.all(
    results.map((result, index) => {
      if (
        result.status === "rejected" &&
        /statusCode.*(404|410)|"statusCode":4(04|10)/.test(String(result.reason))
      ) {
        return adminClient
          .from("push_subscriptions")
          .update({ is_active: false })
          .eq("id", subs[index].id);
      }
      return Promise.resolve();
    }),
  );

  const sentCount = results.filter((r) => r.status === "fulfilled").length;
  await adminClient
    .from("notification_events")
    .update({
      status: sentCount > 0 ? "sent" : "failed",
      sent_at: new Date().toISOString(),
    })
    .eq("id", event.id);

  return json({ sent: sentCount, failed: results.length - sentCount });
});

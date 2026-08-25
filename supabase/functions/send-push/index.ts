import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { timingSafeEqual } from "node:crypto";
import webpush from "npm:web-push@3";

// Deployed with verify_jwt=false: this is invoked from a Postgres trigger
// (notify_delivery_proposal_push, delivery_proposals AFTER INSERT), which
// has no user JWT to present. In place of gateway-level JWT auth, the
// trigger and this function share a dedicated secret (SEND_PUSH_TRIGGER_SECRET
// here, vault's 'send_push_trigger_secret' on the Postgres side) -- see gate
// 1 below. The DB re-validation (gate 3) is kept as defense in depth, not
// replaced by the secret check.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const TRIGGER_SECRET = Deno.env.get("SEND_PUSH_TRIGGER_SECRET");

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails("mailto:support@saovia.app", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

type SendPushPayload = {
  proposal_id?: string;
  driver_id?: string;
  order_id?: string;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Constant-time comparison via Node's `timingSafeEqual` (node:crypto,
 * supported in the Deno-based Supabase Edge Runtime through the `node:`
 * specifier). Deliberately NOT `crypto.subtle.timingSafeEqual` -- that
 * method does not exist on the standard Web Crypto API / Deno's
 * `crypto.subtle`; an earlier draft of this function incorrectly assumed it
 * did. Confirmed working against the live deployed edge runtime via a
 * temporary, non-production test secret (both the mismatch and match paths
 * were exercised for real: 401 on wrong secret, correct pass-through to the
 * VAPID gate on the right one). The test secret was never committed and no
 * longer works after this file was redeployed.
 *
 * Node's timingSafeEqual throws on unequal-length buffers rather than
 * returning false, so length is checked first. That length check is itself
 * not constant-time, but comparing a fixed-format secret's length is
 * standard, accepted practice (the same tradeoff Node's own docs describe)
 * -- the actual byte-content comparison below is what stays constant-time.
 */
function safeCompare(a: string, b: string): boolean {
  const bufA = new TextEncoder().encode(a);
  const bufB = new TextEncoder().encode(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Gate 1, before anything else: no valid shared secret, no processing at
  // all -- no payload parsing, no DB read. Closes the "unauthenticated
  // direct call can re-trigger a push for a known proposal id" surface
  // flagged in review.
  if (!TRIGGER_SECRET) {
    return json({ error: "Server misconfigured." }, 500);
  }
  const providedSecret = req.headers.get("x-send-push-secret");
  if (!providedSecret || !safeCompare(providedSecret, TRIGGER_SECRET)) {
    return json({ error: "Unauthorized" }, 401);
  }

  // Gate 2, only reached once gate 1 passes: VAPID inert-check (unchanged
  // from the prior version).
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return json({ skipped: true, reason: "vapid_not_configured" }, 200);
  }

  let payload: SendPushPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Corps de requête JSON invalide." }, 400);
  }

  if (!payload.proposal_id || !payload.driver_id) {
    return json({ error: "proposal_id et driver_id requis." }, 400);
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Gate 3: re-validate against the DB even though the caller is now
  // authenticated -- defense in depth, not replaced by the secret check.
  const { data: proposal } = await adminClient
    .from("delivery_proposals")
    .select("id, driver_id, status")
    .eq("id", payload.proposal_id)
    .eq("status", "pending")
    .maybeSingle();

  if (!proposal || proposal.driver_id !== payload.driver_id) {
    return json({ skipped: true, reason: "proposal_not_found_or_not_pending" });
  }

  const { data: subs } = await adminClient
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("driver_id", proposal.driver_id);

  if (!subs || subs.length === 0) {
    return json({ sent: 0 });
  }

  const notificationPayload = JSON.stringify({
    title: "Nouvelle course SAOVIA",
    body: "Une nouvelle livraison vous est proposée.",
    url: "/livreur",
    // Same value as the foreground Notification's `tag` in
    // useDriverProposalAlert.ts -- the OS notification center coalesces
    // matching tags into one, so a driver never sees this and the
    // foreground alert stacked as two separate notifications.
    tag: proposal.id,
  });

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        notificationPayload,
      ),
    ),
  );

  // A 404/410 from the push service means that endpoint is permanently
  // gone (browser data cleared, app uninstalled, etc.) -- drop it so
  // push_subscriptions doesn't accumulate dead rows we'll keep failing to
  // send to.
  await Promise.all(
    results.map((result, index) => {
      if (
        result.status === "rejected" &&
        /statusCode.*(404|410)|"statusCode":4(04|10)/.test(String(result.reason))
      ) {
        return adminClient.from("push_subscriptions").delete().eq("endpoint", subs[index].endpoint);
      }
      return Promise.resolve();
    }),
  );

  return json({
    sent: results.filter((r) => r.status === "fulfilled").length,
    failed: results.filter((r) => r.status === "rejected").length,
  });
});

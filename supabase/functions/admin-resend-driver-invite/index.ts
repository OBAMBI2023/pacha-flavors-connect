import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

type ResendInvitePayload = {
  driver_id: string;
  activation_redirect_to: string;
};

/**
 * "Renvoyer l'invitation": regenerates a fresh activation link for a driver
 * still stuck in pending_invitation. Uses a recovery-type link rather than
 * re-inviting -- generateLink(type: 'invite') errors on an already-registered
 * email, but 'recovery' works for any existing user regardless of whether
 * they've ever signed in, and lands on the same /livreur/activation page.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Authentification requise." }, 401);

  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Session invalide." }, 401);

  let payload: ResendInvitePayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Corps de requête JSON invalide." }, 400);
  }

  const driverId = (payload.driver_id ?? "").trim();
  const redirectTo = (payload.activation_redirect_to ?? "").trim();
  if (!driverId) return json({ error: "driver_id requis." }, 400);
  if (!redirectTo) return json({ error: "URL d'activation manquante." }, 400);
  // TEMP DEBUG -- remove once the redirect_to loss is confirmed fixed.
  console.log("[activation-debug] admin-resend-driver-invite received activation_redirect_to:", redirectTo);

  // Scoped to the caller's own JWT: this also enforces owner/manager access
  // to this exact driver's restaurant via driver_profiles_select_tenant_staff.
  const { data: driver, error: driverError } = await callerClient
    .from("driver_profiles")
    .select("id, restaurant_id, email, account_status")
    .eq("id", driverId)
    .maybeSingle();

  if (driverError || !driver) return json({ error: "Livreur introuvable." }, 404);
  if (!driver.email) return json({ error: "Ce livreur n'a pas d'e-mail enregistré." }, 400);

  const { data: membership, error: membershipError } = await callerClient
    .from("restaurant_memberships")
    .select("role")
    .eq("restaurant_id", driver.restaurant_id)
    .eq("user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError || !membership || !["owner", "manager"].includes(membership.role)) {
    return json({ error: "Accès refusé : réservé au propriétaire ou au gérant de ce restaurant." }, 403);
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  // TEMP DEBUG -- remove once the redirect_to loss is confirmed fixed.
  console.log("[activation-debug] admin-resend-driver-invite calling generateLink(recovery) with redirectTo:", redirectTo);
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: "recovery",
    email: driver.email,
    options: { redirectTo },
  });

  if (linkError || !linkData.properties?.action_link) {
    return json({ error: linkError?.message ?? "Impossible de générer le lien d'activation." }, 400);
  }

  // TEMP DEBUG -- remove once the redirect_to loss is confirmed fixed. Logs
  // only the redirect_to param GoTrue actually recorded, never the token.
  try {
    console.log(
      "[activation-debug] generateLink response redirect_to param:",
      new URL(linkData.properties.action_link).searchParams.get("redirect_to"),
    );
  } catch {
    console.log("[activation-debug] could not parse action_link as URL");
  }

  const { error: updateError } = await callerClient
    .from("driver_profiles")
    .update({ invited_at: new Date().toISOString() })
    .eq("id", driverId);
  if (updateError) return json({ error: updateError.message }, 400);

  return json({ activation_link: linkData.properties.action_link });
});

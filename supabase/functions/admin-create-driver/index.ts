import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Allowlist, not "*" -- staff-only endpoint (owner/manager), never called
// cross-origin by a third party. Only the confirmed dev origin is listed
// today; the production origin is not yet confirmed (see CORS audit) --
// add it here once confirmed, never widen back to "*".
const ALLOWED_ORIGINS = ["http://localhost:5173"];

function buildCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  return headers;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type CreateDriverPayload = {
  restaurant_id: string;
  full_name: string;
  phone: string;
  email: string;
  phone_secondary?: string | null;
  address?: string | null;
  date_of_birth?: string | null;
  hired_at?: string | null;
  internal_note?: string | null;
  activation_redirect_to: string;
};

Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req.headers.get("Origin"));
  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Authentification requise." }, 401);

  // Client scoped to the CALLER's own JWT -- the permission check runs as
  // this user, never as service_role. service_role below is only ever used
  // for auth.admin.generateLink and the find_auth_user_id_by_email RPC.
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Session invalide." }, 401);

  let payload: CreateDriverPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Corps de requête JSON invalide." }, 400);
  }

  const restaurantId = (payload.restaurant_id ?? "").trim();
  const fullName = (payload.full_name ?? "").trim();
  const phone = (payload.phone ?? "").trim();
  const email = (payload.email ?? "").trim().toLowerCase();
  const redirectTo = (payload.activation_redirect_to ?? "").trim();

  if (!restaurantId) return json({ error: "restaurant_id requis." }, 400);
  if (!fullName) return json({ error: "Le nom complet est requis." }, 400);
  if (!phone) return json({ error: "Le téléphone est requis." }, 400);
  if (!email || !EMAIL_RE.test(email)) return json({ error: "E-mail invalide." }, 400);
  if (!redirectTo) return json({ error: "URL d'activation manquante." }, 400);
  // TEMP DEBUG -- remove once the redirect_to loss is confirmed fixed. Logs
  // only the redirect target, never the generated token/link.
  console.log("[activation-debug] admin-create-driver received activation_redirect_to:", redirectTo);

  const { data: membership, error: membershipError } = await callerClient
    .from("restaurant_memberships")
    .select("role")
    .eq("restaurant_id", restaurantId)
    .eq("user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError || !membership || !["owner", "manager"].includes(membership.role)) {
    return json({ error: "Accès refusé : réservé au propriétaire ou au gérant de ce restaurant." }, 403);
  }

  // Soft duplicate check: no DB-level uniqueness on phone today, so this is
  // a friendly guard, not a new business rule -- scoped to this restaurant
  // like everything else here, not a global phone registry.
  const { data: existingPhone } = await callerClient
    .from("driver_profiles")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("phone", phone)
    .maybeSingle();
  if (existingPhone) return json({ error: "Un livreur avec ce numéro de téléphone existe déjà." }, 400);

  // service_role is only ever used for generateLink and the auth.users email
  // lookup below -- every table read/write still goes through adminClient
  // only because the driver_profiles insert must succeed even though the
  // newly created auth user has no restaurant_memberships row
  // (driver_profiles_insert_owner_manager is keyed on the CALLER's
  // membership, not the new user's).
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let driverId: string;
  let activationLink: string;

  // TEMP DEBUG -- remove once the redirect_to loss is confirmed fixed.
  console.log("[activation-debug] admin-create-driver calling generateLink(invite) with redirectTo:", redirectTo);
  const inviteResult = await adminClient.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo, data: { full_name: fullName, role: "driver" } },
  });

  if (inviteResult.error || !inviteResult.data.user) {
    const alreadyRegistered = /already.*registered|already.*exists/i.test(inviteResult.error?.message ?? "");
    if (!alreadyRegistered) {
      return json({ error: inviteResult.error?.message ?? "Impossible de créer le compte du livreur." }, 400);
    }

    // "Compte Auth existe mais profil driver absent" / "Email déjà utilisé":
    // find the existing account and decide which case this is.
    const { data: existingUserId, error: lookupError } = await adminClient.rpc("find_auth_user_id_by_email", {
      p_email: email,
    });
    if (lookupError || !existingUserId) {
      return json({ error: "Cet e-mail est déjà utilisé et le compte associé est introuvable." }, 400);
    }

    const { data: existingDriverProfile } = await adminClient
      .from("driver_profiles")
      .select("id")
      .eq("id", existingUserId)
      .maybeSingle();
    if (existingDriverProfile) {
      return json({ error: "Un livreur existe déjà avec cet e-mail." }, 400);
    }

    // Orphaned auth account, no driver profile: attach this profile to it
    // instead of creating a duplicate account. A recovery link re-activates
    // it exactly like an invite would.
    const recoveryResult = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    if (recoveryResult.error || !recoveryResult.data.properties?.action_link) {
      return json({ error: recoveryResult.error?.message ?? "Impossible de générer le lien d'activation." }, 400);
    }
    driverId = existingUserId as string;
    activationLink = recoveryResult.data.properties.action_link;
  } else {
    driverId = inviteResult.data.user.id;
    activationLink = inviteResult.data.properties?.action_link ?? "";
    if (!activationLink) return json({ error: "Impossible de générer le lien d'activation." }, 400);
  }

  // TEMP DEBUG -- remove once the redirect_to loss is confirmed fixed. Logs
  // only the redirect_to param GoTrue actually recorded, never the token.
  try {
    console.log(
      "[activation-debug] generateLink response redirect_to param:",
      new URL(activationLink).searchParams.get("redirect_to"),
    );
  } catch {
    console.log("[activation-debug] could not parse activationLink as URL");
  }

  const { error: insertError } = await adminClient.from("driver_profiles").insert({
    id: driverId,
    restaurant_id: restaurantId,
    full_name: fullName,
    phone,
    email,
    phone_secondary: payload.phone_secondary?.trim() || null,
    address: payload.address?.trim() || null,
    date_of_birth: payload.date_of_birth || null,
    hired_at: payload.hired_at || null,
    internal_note: payload.internal_note?.trim() || null,
    status: "available",
    account_status: "pending_invitation",
    invited_at: new Date().toISOString(),
  });

  if (insertError) {
    // Never leave a brand-new orphaned Auth account with no driver_profiles
    // row. Only delete the auth user if we just created it -- an existing
    // (previously orphaned) account being re-attached must survive a failed
    // insert here so it can be retried, not be deleted out from under it.
    if (!inviteResult.error) await adminClient.auth.admin.deleteUser(driverId);
    return json({ error: insertError.message ?? "Impossible de créer le livreur." }, 400);
  }

  return json({ driver_id: driverId, email_used: email, activation_link: activationLink });
});

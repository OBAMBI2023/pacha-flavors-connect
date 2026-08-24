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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Drivers log in with real email/password (see livreur.tsx), but phone is
 * the required contact field here and many drivers won't have an email --
 * when none is given we synthesize a non-deliverable placeholder purely so
 * auth.users has the identifier it needs. The driver still needs to know
 * this string to log in, so it's always returned to the admin (and stored)
 * regardless of whether it's real or synthetic.
 */
function synthesizeEmail(): string {
  return `driver-${crypto.randomUUID().slice(0, 8)}@drivers.saovia.internal`;
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

type CreateDriverPayload = {
  restaurant_id: string;
  full_name: string;
  phone: string;
  email?: string | null;
  phone_secondary?: string | null;
  address?: string | null;
  date_of_birth?: string | null;
  hired_at?: string | null;
  internal_note?: string | null;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Authentification requise." }, 401);

  // Client scoped to the CALLER's own JWT -- the permission check runs as
  // this user, never as service_role. service_role below is only ever used
  // for auth.admin.createUser/deleteUser.
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
  const emailInput = (payload.email ?? "").trim().toLowerCase();

  if (!restaurantId) return json({ error: "restaurant_id requis." }, 400);
  if (!fullName) return json({ error: "Le nom complet est requis." }, 400);
  if (!phone) return json({ error: "Le téléphone est requis." }, 400);
  if (emailInput && !EMAIL_RE.test(emailInput)) return json({ error: "E-mail invalide." }, 400);

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

  const email = emailInput || synthesizeEmail();
  const tempPassword = generateTempPassword();

  // service_role is only ever used for this one call -- never for table
  // reads/writes, which happen on adminClient below only because the
  // driver_profiles insert must succeed even though the newly created
  // auth user has no restaurant_memberships row (driver_profiles_insert_owner_manager
  // is keyed on the CALLER's membership, not the new user's).
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: "driver" },
  });

  if (createUserError || !createdUser?.user) {
    const message = createUserError?.message?.includes("already been registered")
      ? "Cet e-mail est déjà utilisé par un autre compte."
      : (createUserError?.message ?? "Impossible de créer le compte du livreur.");
    return json({ error: message }, 400);
  }

  const driverId = createdUser.user.id;

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
  });

  if (insertError) {
    // Never leave an orphaned Auth account with no driver_profiles row.
    await adminClient.auth.admin.deleteUser(driverId);
    return json({ error: insertError.message ?? "Impossible de créer le livreur." }, 400);
  }

  return json({ driver_id: driverId, email_used: email, temp_password: tempPassword });
});

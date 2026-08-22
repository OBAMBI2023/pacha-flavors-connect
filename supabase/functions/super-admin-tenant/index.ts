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

function validatePassword(password: unknown): string | null {
  if (typeof password !== "string") return "Mot de passe requis.";
  if (password.length < 8) return "Le mot de passe doit contenir au moins 8 caractères.";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Le mot de passe doit contenir au moins une lettre et un chiffre.";
  }
  return null;
}

type CreatePayload = {
  action: "create";
  restaurant: {
    name: string;
    slug: string;
    phone?: string | null;
    whatsapp_phone?: string | null;
    email?: string | null;
    address?: string | null;
    commune?: string | null;
    city?: string | null;
    status?: "trial" | "active" | "suspended" | "archived";
  };
  admin: { name?: string | null; email: string; password: string };
  theme?: {
    primary_color?: string | null;
    secondary_color?: string | null;
    accent_color?: string | null;
    background_color?: string | null;
    surface_color?: string | null;
    text_color?: string | null;
    font_family?: string | null;
    border_radius?: string | null;
  };
};

type ResetPasswordPayload = {
  action: "reset_password";
  restaurant_id: string;
  new_password: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Authentification requise." }, 401);

  // Client scoped to the CALLER's own JWT -- every RLS/is_super_admin() check
  // downstream runs as this user, never as service_role. This is the only
  // client used to verify the caller and to perform the table writes.
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Session invalide." }, 401);

  const { data: isSuperAdmin, error: superAdminError } = await callerClient.rpc("is_super_admin");
  if (superAdminError || !isSuperAdmin) {
    return json({ error: "Accès refusé : réservé au Super Admin." }, 403);
  }

  // service_role is only ever used for auth.admin.* -- never for table
  // reads/writes, which always go through callerClient above so ordinary
  // RLS/is_super_admin() checks apply exactly as everywhere else in the app.
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let payload: CreatePayload | ResetPasswordPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Corps de requête JSON invalide." }, 400);
  }

  if (payload.action === "create") {
    return handleCreate(payload, callerClient, adminClient);
  }
  if (payload.action === "reset_password") {
    return handleResetPassword(payload, callerClient, adminClient);
  }
  return json({ error: "Action inconnue." }, 400);
});

async function handleCreate(
  payload: CreatePayload,
  // deno-lint-ignore no-explicit-any
  callerClient: any,
  // deno-lint-ignore no-explicit-any
  adminClient: any,
) {
  const restaurant = payload.restaurant;
  const admin = payload.admin;
  const theme = payload.theme ?? {};

  const name = (restaurant?.name ?? "").trim();
  const slug = (restaurant?.slug ?? "").trim();
  const email = (admin?.email ?? "").trim().toLowerCase();
  const password = admin?.password ?? "";

  if (!name) return json({ error: "Le nom du restaurant est requis." }, 400);
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return json({ error: "Le slug doit être en minuscules, chiffres et tirets uniquement." }, 400);
  }
  if (!email || !EMAIL_RE.test(email)) return json({ error: "E-mail administrateur invalide." }, 400);
  const passwordError = validatePassword(password);
  if (passwordError) return json({ error: passwordError }, 400);

  const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: admin?.name ? { full_name: admin.name } : undefined,
  });

  if (createUserError || !createdUser?.user) {
    const message = createUserError?.message?.includes("already been registered")
      ? "Cet e-mail est déjà utilisé par un autre compte."
      : (createUserError?.message ?? "Impossible de créer le compte administrateur.");
    return json({ error: message }, 400);
  }

  const ownerUserId = createdUser.user.id;

  const { data: restaurantId, error: rpcError } = await callerClient.rpc("super_admin_create_tenant", {
    _owner_user_id: ownerUserId,
    _name: name,
    _slug: slug,
    _phone: restaurant?.phone || null,
    _whatsapp_phone: restaurant?.whatsapp_phone || null,
    _email: restaurant?.email || null,
    _address: restaurant?.address || null,
    _commune: restaurant?.commune || null,
    _city: restaurant?.city || null,
    _status: restaurant?.status ?? "active",
    _primary_color: theme.primary_color || null,
    _secondary_color: theme.secondary_color || null,
    _accent_color: theme.accent_color || null,
    _background_color: theme.background_color || null,
    _surface_color: theme.surface_color || null,
    _text_color: theme.text_color || null,
    _font_family: theme.font_family || null,
    _border_radius: theme.border_radius || null,
  });

  if (rpcError || !restaurantId) {
    // Roll back the orphaned Auth account -- never leave a partially
    // created tenant (an Auth user with no restaurant/membership).
    await adminClient.auth.admin.deleteUser(ownerUserId);
    const message = rpcError?.message?.includes("duplicate key")
      ? "Ce slug de restaurant est déjà utilisé."
      : (rpcError?.message ?? "Impossible de créer le restaurant.");
    return json({ error: message }, 400);
  }

  return json({ restaurant_id: restaurantId, name, slug, admin_email: email });
}

async function handleResetPassword(
  payload: ResetPasswordPayload,
  // deno-lint-ignore no-explicit-any
  callerClient: any,
  // deno-lint-ignore no-explicit-any
  adminClient: any,
) {
  const restaurantId = payload.restaurant_id;
  const newPassword = payload.new_password;
  if (!restaurantId) return json({ error: "restaurant_id requis." }, 400);
  const passwordError = validatePassword(newPassword);
  if (passwordError) return json({ error: passwordError }, 400);

  const { data: ownerUserId, error: ownerError } = await callerClient.rpc("super_admin_get_tenant_owner", {
    _restaurant_id: restaurantId,
  });
  if (ownerError || !ownerUserId) {
    return json({ error: ownerError?.message ?? "Propriétaire introuvable pour ce restaurant." }, 400);
  }

  const { error: updateError } = await adminClient.auth.admin.updateUserById(ownerUserId, {
    password: newPassword,
  });
  if (updateError) return json({ error: updateError.message }, 400);

  return json({ success: true });
}

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const EMAIL_FROM = "SAOVIA Food <noreply@saovia.net>";

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

type ResendInvitePayload = {
  driver_id: string;
  activation_redirect_to: string;
};

/** Plain-text fallback for email clients that don't render HTML. */
function activationEmailText(actionLink: string): string {
  return [
    "Bienvenue dans SAOVIA Food",
    "",
    "Vous avez été invité(e) à rejoindre l'équipe de livraison de votre restaurant sur SAOVIA Food.",
    "Activez votre compte en ouvrant le lien ci-dessous :",
    "",
    actionLink,
    "",
    "Ce lien est personnel et à usage unique. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.",
    "",
    "Cet e-mail a été envoyé automatiquement par SAOVIA Food.",
  ].join("\n");
}

/** Professional, responsive, inline-CSS activation email -- table-based
 * layout and inline styles throughout for maximum email-client
 * compatibility (Gmail, Outlook, Apple Mail). No external assets/fonts. */
function activationEmailHtml(actionLink: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Votre invitation à rejoindre SAOVIA Food</title>
  </head>
  <body style="margin:0; padding:0; background-color:#faf7f2; font-family:Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf7f2; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background-color:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 8px 30px rgba(20,10,5,0.08);">
            <tr>
              <td style="background-color:#1B140F; padding:28px 32px; text-align:center;">
                <span style="display:inline-block; font-size:20px; font-weight:800; color:#ffffff; letter-spacing:0.02em;">
                  SAOVIA <span style="color:#ff5a00;">Food</span>
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px 8px 32px; text-align:center;">
                <h1 style="margin:0; font-size:22px; line-height:1.3; color:#1B140F; font-weight:800;">
                  Bienvenue dans SAOVIA Food
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 32px 0 32px; text-align:center;">
                <p style="margin:0; font-size:15px; line-height:1.6; color:#4B4745;">
                  Vous avez été invité(e) à rejoindre l'équipe de livraison de votre restaurant sur SAOVIA Food.
                </p>
                <p style="margin:16px 0 0 0; font-size:15px; line-height:1.6; color:#4B4745;">
                  Pour commencer à recevoir vos courses, activez votre compte en cliquant sur le bouton ci-dessous et en choisissant votre mot de passe.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 8px 32px; text-align:center;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                  <tr>
                    <td style="border-radius:999px; background-color:#ff5a00;">
                      <a
                        href="${actionLink}"
                        target="_blank"
                        rel="noopener noreferrer"
                        style="display:inline-block; padding:14px 32px; font-size:16px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:999px;"
                      >
                        Activer mon compte
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 0 32px; text-align:center;">
                <p style="margin:0; font-size:12.5px; line-height:1.6; color:#9a938c;">
                  Ce lien est personnel et à usage unique. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail en toute sécurité.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 28px 32px;">
                <hr style="border:none; border-top:1px solid #f0e9df; margin:0 0 20px 0;" />
                <p style="margin:0; font-size:12px; line-height:1.6; color:#b3aca4; text-align:center;">
                  Cet e-mail a été envoyé automatiquement par SAOVIA Food.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Sends the activation email via the Resend HTTP API. Resolves to `true`
 * only when Resend itself confirms acceptance; never throws -- the caller
 * decides what a failure means for the rest of the flow. Never logs the
 * API key or the action link (which is a live, single-use auth token). */
async function sendActivationEmail(
  to: string,
  actionLink: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [to],
        subject: "Votre invitation à rejoindre SAOVIA Food",
        html: activationEmailHtml(actionLink),
        text: activationEmailText(actionLink),
      }),
    });
  } catch {
    return { ok: false, message: "Impossible de contacter le service d'e-mail." };
  }

  if (!response.ok) {
    // Resend's error body may contain the recipient address but never a
    // secret -- safe to read for a server-side error message, still never
    // logged with the API key or the action link.
    let detail = "";
    try {
      const body = (await response.json()) as { message?: string };
      detail = body?.message ?? "";
    } catch {
      // ignore parse failure, fall back to status text below
    }
    return {
      ok: false,
      message: detail || `Échec de l'envoi de l'e-mail (statut ${response.status}).`,
    };
  }

  return { ok: true };
}

/**
 * "Renvoyer l'invitation": regenerates a fresh activation link for a driver
 * still stuck in pending_invitation, then emails it via Resend. Uses a
 * recovery-type link rather than re-inviting -- generateLink(type: 'invite')
 * errors on an already-registered email, but 'recovery' works for any
 * existing user regardless of whether they've ever signed in, and lands on
 * the same /livreur/activation page.
 *
 * The invitation is only considered sent once Resend confirms success;
 * `driver_profiles.invited_at` is updated only after that confirmation.
 */
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
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: "recovery",
    email: driver.email,
    options: { redirectTo },
  });

  if (linkError || !linkData.properties?.action_link) {
    return json({ error: linkError?.message ?? "Impossible de générer le lien d'activation." }, 400);
  }

  const emailResult = await sendActivationEmail(driver.email, linkData.properties.action_link);
  if (!emailResult.ok) {
    // Never treat the invitation as sent when Resend fails, and never
    // surface the action_link itself in the error response.
    return json({ error: `Échec de l'envoi de l'invitation par e-mail : ${emailResult.message}` }, 502);
  }

  const { error: updateError } = await callerClient
    .from("driver_profiles")
    .update({ invited_at: new Date().toISOString() })
    .eq("id", driverId);
  if (updateError) return json({ error: updateError.message }, 400);

  return json({ success: true });
});

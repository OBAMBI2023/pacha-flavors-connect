/**
 * Central email configuration -- reads everything from environment
 * variables (Supabase Edge Function secrets, set via
 * `supabase secrets set KEY=value`, never committed to git) and never logs
 * a secret value.
 *
 * This is server-only code: it lives under supabase/functions (Deno edge
 * runtime), not under src/ (the Vite-bundled frontend). Anything imported
 * from src/ ships to the browser -- an SMTP/API credential must never be
 * reachable from there, so this module is deliberately kept out of that
 * tree entirely rather than relying on a naming convention to keep it out
 * of the client bundle.
 *
 * Provider note: Supabase Edge Functions run on a runtime that does not
 * support raw outbound TCP sockets, so the literal SMTP wire protocol
 * (a persistent connection to port 587/465) cannot be spoken from here --
 * only HTTPS `fetch` is reliably available. This project already sends
 * transactional email from an edge function (see
 * supabase/functions/admin-resend-driver-invite) via Resend's HTTP API for
 * exactly that reason. Resend also exposes classic SMTP credentials
 * (host smtp.resend.com, user "resend", password = the same API key) --
 * those are for Supabase Auth's own *Custom SMTP* setting, which runs on
 * Supabase's own backend (not an edge function) and therefore can speak
 * real SMTP. This service is the HTTP-API side of that same account, used
 * for anything sent by this project's own code instead of Supabase Auth's
 * mailer (see the 4 built-in Auth email types instead: signup
 * confirmation, recovery, email change, invite -- configured directly in
 * Supabase, not sent through this file).
 */

export type EmailProviderConfig = {
  apiKey: string;
  fromEmail: string;
  fromName: string;
};

function readEnv(name: string): string | undefined {
  return Deno.env.get(name)?.trim() || undefined;
}

/**
 * Throws with the names of whatever is missing (never the values) --
 * fail fast at cold start rather than on the first real send attempt.
 */
export function loadEmailConfig(): EmailProviderConfig {
  const apiKey = readEnv("RESEND_API_KEY");
  const fromEmail = readEnv("SMTP_FROM_EMAIL") ?? "noreply@saovia.net";
  const fromName = readEnv("SMTP_FROM_NAME") ?? "SAOVIA FOOD";

  const missing: string[] = [];
  if (!apiKey) missing.push("RESEND_API_KEY");

  if (missing.length > 0) {
    throw new Error(
      `[email/config] Variable(s) d'environnement manquante(s) : ${missing.join(", ")}`,
    );
  }

  return { apiKey: apiKey!, fromEmail, fromName };
}

export function formatFromHeader(config: EmailProviderConfig): string {
  return `${config.fromName} <${config.fromEmail}>`;
}

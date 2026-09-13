import { formatFromHeader, loadEmailConfig } from "./config.ts";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  /** Plain-text fallback -- always provide one; some clients and spam filters penalize HTML-only email. */
  text: string;
};

export type SendEmailResult = { ok: true } | { ok: false; message: string };

/**
 * Sends one transactional email via Resend's HTTPS API (see config.ts for
 * why this project uses that instead of a raw SMTP socket from an edge
 * function). TLS is inherent to the `https://` call -- there is no
 * plaintext fallback.
 *
 * Never throws: every failure path (network error, non-2xx response) comes
 * back as `{ ok: false, message }` so a caller can decide what a failed
 * send means for the rest of its own flow (e.g. never mark an invitation as
 * sent when this returns `ok: false`). Never logs the API key, and never
 * logs the full recipient/content payload -- only a redacted summary.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  let config;
  try {
    config = loadEmailConfig();
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Configuration e-mail invalide.",
    };
  }

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: formatFromHeader(config),
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
  } catch (err) {
    console.error("[email-service] network error contacting Resend", {
      recipientDomain: input.to.split("@")[1] ?? "?",
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, message: "Impossible de contacter le service d'e-mail." };
  }

  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as { message?: string };
      detail = body?.message ?? "";
    } catch {
      // ignore parse failure, fall back to status text below
    }
    // Safe to log: Resend's error body never contains the API key, and this
    // never includes the email's html/text body or the recipient's full
    // address.
    console.error("[email-service] Resend rejected the send", {
      status: response.status,
      detail,
      recipientDomain: input.to.split("@")[1] ?? "?",
    });
    return {
      ok: false,
      message: detail || `Échec de l'envoi de l'e-mail (statut ${response.status}).`,
    };
  }

  return { ok: true };
}

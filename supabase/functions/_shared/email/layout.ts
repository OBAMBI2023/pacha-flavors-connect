/**
 * Shared HTML shell for every SAOVIA FOOD transactional email sent by this
 * project's own code (via email-service.ts). The 4 Supabase Auth email
 * types (signup confirmation, recovery, email change, invite) are instead
 * sent by Supabase's own backend from the static files in
 * supabase/templates/*.html -- those can't import this module (Supabase's
 * template engine only reads a plain .html file), so this is a *visual*
 * mirror of the same design, not a shared runtime dependency. Keep both in
 * sync by hand when the brand identity changes.
 */

export const BRAND = {
  orange: "#FF5A1F",
  orangeSecondary: "#FF7A00",
  green: "#2E9E44",
  black: "#111827",
  navy: "#172033",
  bgLight: "#FFF8F3",
  white: "#FFFFFF",
  textSecondary: "#66736C",
  logoUrl: "https://food.saovia.net/email/saovia-food-logo.png",
  helpUrl:
    "https://api.whatsapp.com/send/?phone=2250758483726&text=" +
    encodeURIComponent("Bonjour SAOVIA FOOD, j'ai besoin d'aide."),
  contactUrl:
    "https://api.whatsapp.com/send/?phone=2250758483726&text=" +
    encodeURIComponent("Bonjour SAOVIA FOOD."),
  privacyUrl: "https://food.saovia.net",
} as const;

export type EmailLayoutInput = {
  title: string;
  preheader: string;
  /** Emoji rendered inside the round badge under the header. */
  badgeEmoji: string;
  badgeBackground: string;
  /** Heading, as raw HTML so a single word/phrase can be wrapped in an accent <span>. */
  headingHtml: string;
  /** Body paragraphs, already HTML-escaped by the caller, one string per paragraph. */
  paragraphs: string[];
  ctaLabel: string;
  ctaUrl: string;
  ctaColor: string;
  /** Short reassurance line shown in the light peach info box (e.g. "if this wasn't you, ignore this email"). */
  infoBoxText: string;
  /** Final one-line security reminder under the divider. */
  securityNote: string;
};

/** Escapes the handful of characters that matter in an HTML text node -- callers still own their own copy, this only makes it safe to interpolate. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderEmailLayout(input: EmailLayoutInput): string {
  const paragraphsHtml = input.paragraphs
    .map(
      (p) =>
        `<p style="margin:14px 0 0 0; font-size:15px; line-height:1.65; color:#374151;">${p}</p>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escapeHtml(input.title)}</title>
    <style>
      body, table, td { font-family: Arial, Helvetica, sans-serif; }
      body { margin: 0; padding: 0; width: 100% !important; background-color: ${BRAND.bgLight}; }
      table { border-collapse: collapse; }
      img { border: 0; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
      a { text-decoration: none; }
      @media screen and (max-width: 600px) {
        .saovia-container { width: 100% !important; }
        .saovia-px { padding-left: 20px !important; padding-right: 20px !important; }
        .saovia-btn { display: block !important; width: 100% !important; }
      }
    </style>
  </head>
  <body style="margin:0; padding:0; background-color:${BRAND.bgLight};">
    <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:${BRAND.bgLight};">
      ${escapeHtml(input.preheader)}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.bgLight};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" class="saovia-container" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:600px;">
            <tr>
              <td class="saovia-px" align="center" style="padding:8px 24px 24px 24px;">
                <img src="${BRAND.logoUrl}" width="64" height="64" alt="SAOVIA FOOD" style="display:block; width:64px; height:64px; border-radius:16px;" />
                <p style="margin:14px 0 0 0; font-size:20px; line-height:1.3; font-weight:800; color:${BRAND.black}; letter-spacing:0.02em;">SAOVIA&nbsp;FOOD</p>
                <p style="margin:4px 0 0 0; font-size:13px; line-height:1.4; color:${BRAND.textSecondary}; font-style:italic;">&ldquo;La gastronomie connect&eacute;e&rdquo;</p>
              </td>
            </tr>
            <tr>
              <td style="background-color:${BRAND.white}; border-radius:24px; box-shadow:0 20px 60px -25px rgba(17,24,39,0.25);">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td class="saovia-px" align="center" style="padding:40px 40px 8px 40px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                        <tr>
                          <td width="72" height="72" align="center" valign="middle" style="width:72px; height:72px; border-radius:36px; background-color:${input.badgeBackground}; font-size:30px; line-height:72px;">${input.badgeEmoji}</td>
                        </tr>
                      </table>
                      <h1 style="margin:24px 0 0 0; font-size:24px; line-height:1.3; font-weight:800; color:${BRAND.black};">${input.headingHtml}</h1>
                    </td>
                  </tr>
                  <tr>
                    <td class="saovia-px" style="padding:20px 40px 0 40px;">
                      <p style="margin:0; font-size:15px; line-height:1.6; color:${BRAND.black}; font-weight:700; font-style:italic;">Bonjour,</p>
                      ${paragraphsHtml}
                    </td>
                  </tr>
                  <tr>
                    <td class="saovia-px" align="center" style="padding:28px 40px 8px 40px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                        <tr>
                          <td class="saovia-btn" align="center" style="border-radius:999px; background-color:${input.ctaColor};">
                            <a href="${input.ctaUrl}" target="_blank" rel="noopener noreferrer" class="saovia-btn" style="display:inline-block; padding:16px 32px; font-size:16px; font-weight:700; color:${BRAND.white}; border-radius:999px; font-family:Arial, Helvetica, sans-serif;">${escapeHtml(input.ctaLabel)}</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td class="saovia-px" style="padding:28px 40px 0 40px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FFF3EC; border-radius:16px;">
                        <tr>
                          <td style="padding:16px 20px; font-size:13.5px; line-height:1.6; color:#7A4B33;">&#128274;&nbsp; ${input.infoBoxText}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td class="saovia-px" style="padding:20px 40px 36px 40px;">
                      <hr style="border:none; border-top:1px solid #EEE3D8; margin:0 0 20px 0;" />
                      <p style="margin:0; font-size:12.5px; line-height:1.6; color:${BRAND.textSecondary};">&#128737;&#65039;&nbsp; ${input.securityNote}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="saovia-px" align="center" style="padding:28px 24px 8px 24px;">
                <p style="margin:0; font-size:14px; font-weight:800; color:${BRAND.navy};">SAOVIA FOOD</p>
                <p style="margin:4px 0 0 0; font-size:12px; color:${BRAND.textSecondary};">La gastronomie connect&eacute;e</p>
                <p style="margin:14px 0 0 0; font-size:12px; color:${BRAND.textSecondary};">Restaurants&nbsp;|&nbsp;Livraison&nbsp;|&nbsp;Solutions digitales</p>
                <p style="margin:18px 0 0 0; font-size:11.5px; color:#9CA3AF;">&copy; 2026 SAOVIA FOOD. Tous droits r&eacute;serv&eacute;s.</p>
                <p style="margin:10px 0 0 0; font-size:11.5px;">
                  <a href="${BRAND.helpUrl}" style="color:${BRAND.textSecondary};">Aide</a>
                  &nbsp;|&nbsp;
                  <a href="${BRAND.privacyUrl}" style="color:${BRAND.textSecondary};">Confidentialit&eacute;</a>
                  &nbsp;|&nbsp;
                  <a href="${BRAND.contactUrl}" style="color:${BRAND.textSecondary};">Contact</a>
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

export function renderEmailFooterText(): string {
  return [
    "",
    "--",
    "SAOVIA FOOD -- La gastronomie connectée",
    "Aide / Contact : https://api.whatsapp.com/send/?phone=2250758483726",
    "© 2026 SAOVIA FOOD. Tous droits réservés.",
  ].join("\n");
}

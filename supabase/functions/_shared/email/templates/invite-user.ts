import { BRAND, renderEmailFooterText, renderEmailLayout } from "../layout.ts";
import type { EmailTemplate } from "./confirm-email.ts";

/**
 * If Supabase's own `auth.admin.inviteUserByEmail()` is used, Supabase Auth
 * sends the real invite email itself from supabase/templates/invite.html
 * (see supabase/config.toml's [auth.email.template.invite]) and this
 * function is not needed.
 *
 * Use this instead when an edge function builds its own invite link via
 * `auth.admin.generateLink()` and sends it through this project's own
 * service -- the same pattern already used for drivers (see
 * supabase/functions/admin-resend-driver-invite), just with the SAOVIA FOOD
 * brand identity instead of that flow's own driver-specific copy.
 */
export function inviteUserTemplate(confirmationUrl: string): EmailTemplate {
  const subject = "Vous êtes invité à rejoindre SAOVIA FOOD";
  const html = renderEmailLayout({
    title: subject,
    preheader: "Acceptez votre invitation à rejoindre SAOVIA FOOD.",
    badgeEmoji: "&#127881;",
    badgeBackground: "#E9F7EC",
    headingHtml: `Vous êtes invité(e) à rejoindre <span style="color:${BRAND.green};">SAOVIA FOOD</span>`,
    paragraphs: [
      "Vous avez été invité(e) à rejoindre l'équipe sur <strong>SAOVIA FOOD</strong>, la plateforme qui connecte les restaurants à leurs clients.",
      "Cliquez sur le bouton ci-dessous pour accepter l'invitation et créer votre accès.",
    ],
    ctaLabel: "Accepter l'invitation →",
    ctaUrl: confirmationUrl,
    ctaColor: BRAND.green,
    infoBoxText:
      "Si vous ne vous attendiez pas à cette invitation, vous pouvez simplement ignorer cet e-mail.",
    securityNote:
      "Pour votre sécurité, ne partagez jamais ce lien d'invitation avec une autre personne.",
  });
  const text = [
    "Vous êtes invité(e) à rejoindre SAOVIA FOOD",
    "",
    "Bonjour,",
    "",
    "Vous avez été invité(e) à rejoindre l'équipe sur SAOVIA FOOD.",
    "Acceptez l'invitation :",
    "",
    confirmationUrl,
    "",
    "Si vous ne vous attendiez pas à cette invitation, vous pouvez ignorer cet e-mail.",
    "Pour votre sécurité, ne partagez jamais ce lien avec une autre personne.",
    renderEmailFooterText(),
  ].join("\n");
  return { subject, html, text };
}

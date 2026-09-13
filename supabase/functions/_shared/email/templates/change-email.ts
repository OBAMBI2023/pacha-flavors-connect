import { BRAND, renderEmailFooterText, renderEmailLayout } from "../layout.ts";
import type { EmailTemplate } from "./confirm-email.ts";

/**
 * Not used by the current flow -- Supabase Auth sends the real "confirm
 * email change" email itself, from supabase/templates/email-change.html
 * (see supabase/config.toml's [auth.email.template.email_change]). Kept
 * here for the same reason as confirm-email.ts/reset-password.ts.
 */
export function changeEmailTemplate(confirmationUrl: string): EmailTemplate {
  const subject = "Confirmez votre nouvelle adresse e-mail — SAOVIA FOOD";
  const html = renderEmailLayout({
    title: subject,
    preheader: "Confirmez le changement d'adresse e-mail de votre compte SAOVIA FOOD.",
    badgeEmoji: "&#9993;&#65039;",
    badgeBackground: "#FFEDE3",
    headingHtml: `Confirmez votre <span style="color:${BRAND.orange};">nouvelle adresse e-mail</span>`,
    paragraphs: [
      "Vous avez demandé à changer l'adresse e-mail associée à votre compte <strong>SAOVIA FOOD</strong>.",
      "Confirmez ce changement en cliquant sur le bouton ci-dessous.",
    ],
    ctaLabel: "Confirmer ma nouvelle adresse e-mail →",
    ctaUrl: confirmationUrl,
    ctaColor: BRAND.orange,
    infoBoxText:
      "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail : votre adresse actuelle restera inchangée.",
    securityNote:
      "Pour votre sécurité, ne partagez jamais ce lien de confirmation avec une autre personne.",
  });
  const text = [
    "Confirmez votre nouvelle adresse e-mail -- SAOVIA FOOD",
    "",
    "Bonjour,",
    "",
    "Vous avez demandé à changer l'adresse e-mail associée à votre compte SAOVIA FOOD.",
    "Confirmez ce changement :",
    "",
    confirmationUrl,
    "",
    "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre adresse actuelle restera inchangée.",
    "Pour votre sécurité, ne partagez jamais ce lien avec une autre personne.",
    renderEmailFooterText(),
  ].join("\n");
  return { subject, html, text };
}

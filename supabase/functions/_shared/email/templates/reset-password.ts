import { BRAND, renderEmailFooterText, renderEmailLayout } from "../layout.ts";
import type { EmailTemplate } from "./confirm-email.ts";

/**
 * Not used by the current password-recovery flow -- Supabase Auth sends the
 * real "reset password" email itself, from supabase/templates/recovery.html
 * (see supabase/config.toml's [auth.email.template.recovery]). Kept here so
 * a future non-Auth recovery-style flow can reuse the same visual design
 * instead of inventing a second one.
 */
export function resetPasswordTemplate(confirmationUrl: string): EmailTemplate {
  const subject = "Réinitialisez votre mot de passe — SAOVIA FOOD";
  const html = renderEmailLayout({
    title: subject,
    preheader: "Réinitialisez votre mot de passe en toute sécurité.",
    badgeEmoji: "&#128274;",
    badgeBackground: "#FFEDE3",
    headingHtml: `Réinitialisez votre <span style="color:${BRAND.orange};">mot de passe</span>`,
    paragraphs: [
      "Vous avez demandé la réinitialisation du mot de passe de votre compte <strong>SAOVIA FOOD</strong>.",
      "Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.",
    ],
    ctaLabel: "Réinitialiser mon mot de passe →",
    ctaUrl: confirmationUrl,
    ctaColor: BRAND.orange,
    infoBoxText:
      "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail : votre mot de passe actuel restera inchangé.",
    securityNote:
      "Pour votre sécurité, ne partagez jamais ce lien de réinitialisation avec une autre personne.",
  });
  const text = [
    "Réinitialisez votre mot de passe -- SAOVIA FOOD",
    "",
    "Bonjour,",
    "",
    "Vous avez demandé la réinitialisation du mot de passe de votre compte SAOVIA FOOD.",
    "Choisissez un nouveau mot de passe :",
    "",
    confirmationUrl,
    "",
    "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe actuel restera inchangé.",
    "Pour votre sécurité, ne partagez jamais ce lien avec une autre personne.",
    renderEmailFooterText(),
  ].join("\n");
  return { subject, html, text };
}

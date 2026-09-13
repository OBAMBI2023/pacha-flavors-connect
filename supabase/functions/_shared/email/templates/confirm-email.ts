import { BRAND, renderEmailFooterText, renderEmailLayout } from "../layout.ts";

export type EmailTemplate = { subject: string; html: string; text: string };

/**
 * Not used by the current signup flow -- Supabase Auth sends the real
 * "confirm signup" email itself, from supabase/templates/confirm-signup.html
 * (see supabase/config.toml's [auth.email.template.confirmation]). This
 * exists so any future code path that needs to send the *same* confirmation
 * design from this project's own service (e.g. a resend action outside
 * Supabase's own resend()) doesn't have to invent a second visual design.
 */
export function confirmEmailTemplate(confirmationUrl: string): EmailTemplate {
  const subject = "Confirmez votre adresse e-mail — SAOVIA FOOD";
  const html = renderEmailLayout({
    title: subject,
    preheader: "Finalisez votre inscription et profitez de SAOVIA FOOD.",
    badgeEmoji: "&#9993;&#65039;",
    badgeBackground: "#FFEDE3",
    headingHtml: `Confirmez votre <span style="color:${BRAND.orange};">adresse e-mail</span>`,
    paragraphs: [
      "Bienvenue sur <strong>SAOVIA FOOD</strong>&nbsp;! &#128075;",
      "Pour finaliser la création de votre compte, veuillez confirmer votre adresse e-mail en cliquant sur le bouton ci-dessous.",
    ],
    ctaLabel: "Confirmer mon adresse e-mail →",
    ctaUrl: confirmationUrl,
    ctaColor: BRAND.orange,
    infoBoxText:
      "Si vous n'êtes pas à l'origine de cette inscription, vous pouvez simplement ignorer cet e-mail.",
    securityNote:
      "Pour votre sécurité, ne partagez jamais ce lien de confirmation avec une autre personne.",
  });
  const text = [
    "Confirmez votre adresse e-mail -- SAOVIA FOOD",
    "",
    "Bonjour,",
    "",
    "Bienvenue sur SAOVIA FOOD !",
    "Pour finaliser la création de votre compte, confirmez votre adresse e-mail :",
    "",
    confirmationUrl,
    "",
    "Si vous n'êtes pas à l'origine de cette inscription, vous pouvez ignorer cet e-mail.",
    "Pour votre sécurité, ne partagez jamais ce lien avec une autre personne.",
    renderEmailFooterText(),
  ].join("\n");
  return { subject, html, text };
}

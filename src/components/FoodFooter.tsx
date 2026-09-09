import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Facebook,
  Globe,
  Heart,
  Instagram,
  Linkedin,
  Music2,
  ShieldCheck,
  Youtube,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildWhatsAppUrl, SAOVIA_SUPPORT_WHATSAPP_NUMBER } from "@/lib/whatsapp";
import logoMark from "@/assets/saovia-food-logo.png";
import footerWorldMapImage from "@/assets/saovia-food-footer-world-map.png";
import flagCI from "@/assets/flags/ci.svg";
import flagSN from "@/assets/flags/sn.svg";
import flagFR from "@/assets/flags/fr.svg";
import flagMA from "@/assets/flags/ma.svg";
import flagCA from "@/assets/flags/ca.svg";
import flagUS from "@/assets/flags/us.svg";

// Same WhatsApp advisor link used across every /food* page's "Nous
// contacter" / "Parler à un conseiller" CTAs.
const ADVISOR_WHATSAPP_URL = buildWhatsAppUrl(
  SAOVIA_SUPPORT_WHATSAPP_NUMBER,
  "Bonjour Saovia Technologies, je souhaite parler à un conseiller au sujet de SAOVIA Food.",
);

const FOOTER_BENEFITS = [
  { icon: Zap, title: "Simple", text: "à utiliser" },
  { icon: BarChart3, title: "Rapide", text: "à déployer" },
  { icon: Heart, title: "Efficace", text: "pour votre croissance" },
] as const;

type FooterLink = {
  label: string;
  to?: "/auth" | "/food/conseils";
  href?: string;
  external?: boolean;
};

/** Links without a real destination in this codebase (no dedicated pages
 * for "Sécurité", "Carrières", legal pages, etc. exist yet) render as
 * inert text rather than fake/dead links -- see the render logic below. */
const FOOTER_COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Produit",
    links: [
      { label: "Fonctionnalités", href: "/food#fonctionnalites" },
      { label: "Tarifs", href: "/food#tarifs" },
      { label: "Témoignages", href: "/food#temoignages" },
      { label: "Conseils", to: "/food/conseils" },
      { label: "FAQ", href: "/food#faq" },
      { label: "Sécurité" },
      { label: "Statut du service" },
    ],
  },
  {
    title: "Entreprise",
    links: [
      { label: "À propos" },
      { label: "Notre mission" },
      { label: "Nous contacter", href: ADVISOR_WHATSAPP_URL, external: true },
      { label: "Carrières" },
      { label: "Presse" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Se connecter", to: "/auth" },
      { label: "Parler à un conseiller", href: ADVISOR_WHATSAPP_URL, external: true },
      { label: "Centre d'aide" },
      { label: "Guides" },
      { label: "Conditions d'utilisation" },
      { label: "Politique de confidentialité" },
    ],
  },
];

/** Real circular flag assets (MIT-licensed lipis/flag-icons SVGs, copied
 * as static files into src/assets/flags/ -- no emoji flags, per the brief). */
const FOOTER_COUNTRIES = [
  { flagSrc: flagCI, name: "Côte d'Ivoire" },
  { flagSrc: flagSN, name: "Sénégal" },
  { flagSrc: flagFR, name: "France" },
  { flagSrc: flagMA, name: "Maroc" },
  { flagSrc: flagCA, name: "Canada" },
  { flagSrc: flagUS, name: "États-Unis" },
] as const;

/** Options for the "Votre pays" dropdown specifically -- deliberately its
 * own fixed list of 6 countries (not derived from FOOTER_COUNTRIES above,
 * which drives the separate "Disponible dans plusieurs pays" grid + world
 * map and stays untouched), with no "Autres pays"/"+" catch-all. */
const FOOTER_COUNTRY_SELECT_OPTIONS = [
  { code: "CI", flagSrc: flagCI, name: "Côte d'Ivoire" },
  { code: "SN", flagSrc: flagSN, name: "Sénégal" },
  { code: "FR", flagSrc: flagFR, name: "France" },
  { code: "MA", flagSrc: flagMA, name: "Maroc" },
  { code: "CA", flagSrc: flagCA, name: "Canada" },
  { code: "US", flagSrc: flagUS, name: "États-Unis" },
] as const;

const FOOTER_SECURITY = [
  { icon: ShieldCheck, title: "Données sécurisées", description: "Vos données sont protégées" },
  { icon: Globe, title: "Conforme RGPD", description: "Standards internationaux" },
] as const;

/** No confirmed SAOVIA Food social handles exist anywhere in this codebase
 * yet, so these render as non-interactive icon chips (see render logic)
 * rather than links to fabricated/guessed profile URLs. */
const FOOTER_SOCIALS = [
  { icon: Facebook, label: "Facebook" },
  { icon: Instagram, label: "Instagram" },
  { icon: Linkedin, label: "LinkedIn" },
  { icon: Youtube, label: "YouTube" },
  { icon: Music2, label: "TikTok" },
] as const;

/** Dark "premium SaaS" footer, shared by every /food* page (main landing
 * page and /food/conseils so far). The shared PublicFooter component (used
 * by every tenant storefront and other public page) is left untouched --
 * /food* pages simply don't render it and render this one instead. */
export function FoodFooter() {
  return (
    <footer className="bg-[#080F14] text-[#F7F7F7]">
      {/* Brand column + Produit/Entreprise/Support link columns */}
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-16">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.3fr_1fr_1fr_1fr] lg:gap-8">
          <div>
            <Link to="/food" className="inline-flex items-center gap-2">
              <img src={logoMark} alt="" className="h-9 w-9 rounded-full object-cover" />
              <span className="font-display text-lg font-bold text-white">
                SAOVIA <span className="text-primary">FOOD</span>
              </span>
            </Link>
            <p className="mt-2 text-sm font-medium text-[#AAB7C4]">
              La solution digitale des restaurants.
            </p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#AAB7C4]">
              Digitalisez votre activité dès aujourd'hui et offrez une meilleure expérience à vos
              clients, partout dans le monde.
            </p>

            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
              {FOOTER_BENEFITS.map((benefit) => (
                <div key={benefit.title} className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-primary">
                    <benefit.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <p className="text-xs leading-tight">
                    <span className="block font-semibold text-white">{benefit.title}</span>
                    <span className="block text-[#AAB7C4]">{benefit.text}</span>
                  </p>
                </div>
              ))}
            </div>

            <Button asChild size="lg" className="mt-7 h-12 rounded-full px-7 text-base">
              <Link to="/food-signup">
                Créer mon restaurant <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#AAB7C4]">
                {column.title}
              </p>
              <ul className="mt-4 space-y-2.5 text-sm">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.to ? (
                      <Link to={link.to} className="text-[#AAB7C4] transition-colors hover:text-primary">
                        {link.label}
                      </Link>
                    ) : link.href ? (
                      <a
                        href={link.href}
                        {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        className="text-[#AAB7C4] transition-colors hover:text-primary"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <span className="cursor-default text-[#AAB7C4]/50">{link.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Global section: countries (real circular flag assets) + world
          map (real transparent PNG, dotted continents with orange
          highlight markets already baked in -- no text drawn on top of
          it, per the brief) + language/country selectors + security. */}
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-14">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.05fr_0.85fr] lg:items-start lg:gap-8">
            <div>
              <h3 className="font-display text-lg font-semibold text-white">
                Disponible dans plusieurs pays
              </h3>
              <p className="mt-2 max-w-sm text-sm text-[#AAB7C4]">
                SAOVIA Food accompagne les restaurants à travers l'Afrique et dans le monde.
              </p>
              <ul className="mt-6 grid grid-cols-3 gap-x-4 gap-y-5">
                {FOOTER_COUNTRIES.map((country) => (
                  <li key={country.name} className="flex flex-col items-center gap-2 text-center">
                    <img
                      src={country.flagSrc}
                      alt={`Drapeau ${country.name}`}
                      loading="lazy"
                      className="h-8 w-8 rounded-full object-cover ring-1 ring-white/15 sm:h-9 sm:w-9"
                    />
                    <span className="text-xs text-[#AAB7C4]">{country.name}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* World map, centered in the section as its own column --
                real asset (not a hand-drawn approximation), shown at
                reduced opacity so it reads as discreet/background,
                exactly as supplied (no crop, no text overlay). */}
            <div className="flex flex-col items-center justify-self-center">
              <img
                src={footerWorldMapImage}
                alt=""
                aria-hidden="true"
                loading="lazy"
                className="h-[180px] w-full max-w-[420px] object-contain opacity-60 sm:h-[220px]"
              />
              <p className="mt-2 text-center text-xs italic text-[#AAB7C4]">
                Votre restaurant accessible partout, à tout moment.
              </p>
            </div>

            <div className="flex flex-col gap-5">
              <div>
                <label htmlFor="footer-country" className="mb-2 block text-sm font-semibold text-white">
                  Votre pays
                </label>
                {/* Custom Select (Radix, already a project dependency)
                    instead of a native <select> -- the native element's
                    dropdown is rendered by the OS/browser and always
                    shows as an opaque white panel that can't be
                    restyled, which clashed with this dark footer. Radix
                    renders its own themeable popover, so it can match
                    the premium dark UI while keeping full keyboard/
                    click-outside/Escape support for free. */}
                <Select defaultValue="Côte d'Ivoire">
                  <SelectTrigger
                    id="footer-country"
                    className="h-[52px] w-full justify-between gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-sm text-white shadow-none transition-colors hover:border-primary/60 focus:ring-1 focus:ring-primary data-[state=open]:border-primary/60 [&>span]:line-clamp-1"
                  >
                    <SelectValue placeholder="Votre pays" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    sideOffset={8}
                    className="z-50 max-h-[280px] w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-xl border border-white/10 bg-[#1E140D] text-white shadow-2xl"
                  >
                    {FOOTER_COUNTRY_SELECT_OPTIONS.map((country) => (
                      <SelectItem
                        key={country.code}
                        value={country.name}
                        className="min-h-11 cursor-pointer gap-2.5 rounded-lg py-2.5 pl-3 pr-8 text-sm text-white focus:bg-white/8 focus:text-white data-[state=checked]:bg-primary/15 data-[state=checked]:text-primary [&_svg]:text-primary"
                      >
                        <span className="flex items-center gap-2.5">
                          <img
                            src={country.flagSrc}
                            alt=""
                            aria-hidden="true"
                            className="h-4 w-4 shrink-0 rounded-full object-cover"
                          />
                          {country.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-3">
                {FOOTER_SECURITY.map((item) => (
                  <div
                    key={item.title}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <item.icon className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                    <p className="leading-tight">
                      <span className="block text-sm font-semibold text-white">{item.title}</span>
                      <span className="block text-xs text-[#AAB7C4]">{item.description}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar: copyright, socials, slogan */}
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-center text-xs text-[#AAB7C4] lg:text-left">
            <p>© {new Date().getFullYear()} Saovia Technologies. Tous droits réservés.</p>
            <p className="mt-1">SAOVIA Food est une marque de Saovia Technologies.</p>
          </div>

          <div className="flex flex-col items-center gap-5 sm:flex-row sm:flex-wrap sm:justify-center lg:justify-end">
            <div className="flex flex-col items-center gap-2 sm:items-start">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#AAB7C4]">
                Suivez-nous
              </span>
              <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                {FOOTER_SOCIALS.map((social) => (
                  <span
                    key={social.label}
                    role="img"
                    aria-label={social.label}
                    className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/5 text-[#AAB7C4]"
                  >
                    <social.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                ))}
              </div>
            </div>
          </div>

          <p className="hidden -rotate-2 whitespace-nowrap font-display text-lg italic text-[#AAB7C4] lg:block">
            Plus qu'un logiciel, un partenaire de croissance !
          </p>
        </div>
      </div>
    </footer>
  );
}

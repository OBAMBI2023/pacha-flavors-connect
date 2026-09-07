import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Bike,
  CheckCircle2,
  ChefHat,
  Heart,
  Megaphone,
  Menu,
  Percent,
  QrCode,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Target,
  Users,
  UtensilsCrossed,
  X,
  Zap,
} from "lucide-react";
import { PublicFooter } from "@/components/PublicFooter";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { jsonLdMetaEntry, siteOrigin } from "@/lib/seo";
import { buildWhatsAppUrl, SAOVIA_SUPPORT_WHATSAPP_NUMBER } from "@/lib/whatsapp";
import logoMark from "@/assets/saovia-food-favicon-mark.png";
import qrPosterImage from "@/assets/saovia-food-qr-poster.png";
import heroVisualImage from "@/assets/saovia-food-hero-visual.jpg";
import chefPortraitImage from "@/assets/saovia-food-signup-chef.png";
import heroImmersiveImage from "@/assets/saovia-food-hero-immersive.jpg";
import featuresCornerImage from "@/assets/saovia-food-features-corner.png";

const TITLE = "SAOVIA Food | Logiciel restaurant sans commission";
const DESCRIPTION =
  "Digitalisez votre restaurant avec SAOVIA Food : menu digital, commandes, QR Code, clients, livraisons, promotions, Meta Pixel et statistiques, sans commission sur vos ventes.";

// The primary "Créer mon restaurant" CTA routes to the real /food-signup
// account-creation form (see src/routes/food-signup.tsx) -- WhatsApp below
// is only ever the secondary, advisor/demo/sales path now.
const ADVISOR_WHATSAPP_URL = buildWhatsAppUrl(
  SAOVIA_SUPPORT_WHATSAPP_NUMBER,
  "Bonjour Saovia Technologies, je souhaite parler à un conseiller au sujet de SAOVIA Food.",
);
const SALES_WHATSAPP_URL = buildWhatsAppUrl(
  SAOVIA_SUPPORT_WHATSAPP_NUMBER,
  "Bonjour Saovia Technologies, je souhaite en savoir plus sur les offres SAOVIA Food pour mon restaurant.",
);

/**
 * Every feature below is a real, shipped capability of this codebase (tenant
 * storefronts at /r/:slug, the per-tenant QR code in QrCodeCard.tsx, the
 * admin order/dispatch/CRM/marketing/stats modules) -- never aspirational
 * copy. Adding an entry here without it existing in the product would
 * misrepresent SAOVIA Food.
 */
type FeatureVisualKind =
  | "menu"
  | "qr"
  | "orders"
  | "delivery"
  | "clients"
  | "promo"
  | "stats"
  | "site";

const FEATURES: {
  icon: typeof Store;
  title: string;
  description: string;
  visual: FeatureVisualKind;
}[] = [
  {
    icon: UtensilsCrossed,
    title: "Menu digital",
    description:
      "Un menu moderne, à jour, accessible depuis téléphone, tablette et ordinateur -- sans application à installer.",
    visual: "menu",
  },
  {
    icon: QrCode,
    title: "QR Code automatique",
    description:
      "Un QR Code unique généré pour votre restaurant, à imprimer sur vos tables, flyers ou emballages.",
    visual: "qr",
  },
  {
    icon: ShoppingBag,
    title: "Commandes",
    description: "Recevez et gérez toutes vos commandes depuis un seul espace, en temps réel.",
    visual: "orders",
  },
  {
    icon: Bike,
    title: "Livraison",
    description: "Organisez vos livraisons et suivez vos livreurs en temps réel jusqu'au client.",
    visual: "delivery",
  },
  {
    icon: Users,
    title: "Clients",
    description:
      "Centralisez l'historique de votre clientèle pour mieux la connaître et la fidéliser.",
    visual: "clients",
  },
  {
    icon: Percent,
    title: "Promotions",
    description:
      "Créez des codes promo et des offres pour stimuler vos ventes, avec suivi réel de leur utilisation.",
    visual: "promo",
  },
  {
    icon: BarChart3,
    title: "Statistiques",
    description:
      "Un tableau de bord de vos ventes et commandes pour prendre de meilleures décisions.",
    visual: "stats",
  },
  {
    icon: Store,
    title: "Site vitrine restaurant",
    description:
      "Une page publique dédiée à votre restaurant : menu, photos et informations, prête à être partagée.",
    visual: "site",
  },
];

/** Real, visible eyebrow/title copy for the hero -- the visual itself is the full-bleed photo further down (heroImmersiveImage); heroVisualImage is kept only as the page's og:image. */
const HERO_EYEBROW = "La solution digitale des restaurants";

/**
 * Meta Pixel and the public-page SEO stack (canonical, Open Graph, JSON-LD)
 * are real, shipped mechanisms (src/lib/metaPixel.ts, src/lib/seo.ts) -- a
 * restaurant enables its own pixel from its Admin settings, and every
 * tenant storefront already emits the SEO output described here. Nothing in
 * this section claims a capability the codebase doesn't have.
 */
const MARKETING_ITEMS = [
  {
    icon: Target,
    title: "Meta Pixel intégré",
    description:
      "Activez votre Meta Pixel depuis votre espace SAOVIA Food pour préparer le suivi de vos campagnes Facebook et Instagram.",
  },
  {
    icon: Search,
    title: "Référencement technique",
    description:
      "Métadonnées, données structurées, sitemap et liens canoniques déjà en place pour faciliter l'indexation de votre page par les principaux moteurs de recherche.",
  },
  {
    icon: Share2,
    title: "Open Graph et partage social",
    description:
      "Un aperçu soigné de votre restaurant lorsque votre lien est partagé sur les réseaux sociaux ou WhatsApp.",
  },
  {
    icon: Megaphone,
    title: "Accompagnement Meta Ads",
    description:
      "Selon votre formule ou prestation choisie, bénéficiez d'un accompagnement personnalisé pour vos campagnes Meta.",
  },
] as const;

const HOW_IT_WORKS = [
  {
    number: "01",
    title: "Créez votre restaurant",
    description: "Configurez votre établissement en quelques minutes, sans engagement.",
  },
  {
    number: "02",
    title: "Ajoutez votre menu",
    description: "Ajoutez vos plats, vos prix, vos photos et leurs disponibilités.",
  },
  {
    number: "03",
    title: "Partagez votre QR Code",
    description: "Diffusez votre menu digital sur vos tables, vos flyers et vos réseaux sociaux.",
  },
  {
    number: "04",
    title: "Recevez vos commandes",
    description:
      "Gérez votre activité -- commandes, livraisons, clients -- directement depuis SAOVIA Food.",
  },
] as const;

const PRICING_PLANS = [
  {
    name: "Starter",
    description: "Pour démarrer votre présence digitale.",
    features: ["Menu digital", "QR Code automatique", "Commandes", "Support"],
    price: "Sur devis",
    cta: "Essayer gratuitement",
    href: "/food-signup",
    external: false,
    featured: false,
  },
  {
    name: "Business",
    description: "Pour piloter votre activité au quotidien.",
    features: ["Tout Starter", "Livraison", "Clients", "Promotions", "Statistiques"],
    price: "Sur devis",
    cta: "Essayer gratuitement",
    href: "/food-signup",
    external: false,
    featured: true,
  },
  {
    name: "Pro",
    description: "Pour votre visibilité et votre croissance.",
    features: ["Tout Business", "Meta Pixel", "Accompagnement Meta Ads", "Accompagnement dédié"],
    price: "Sur devis",
    cta: "Nous contacter",
    href: SALES_WHATSAPP_URL,
    external: true,
    featured: false,
  },
] as const;

const FAQ = [
  {
    question: "Comment créer mon restaurant ?",
    answer:
      "Créez votre compte en quelques minutes depuis la page d'inscription : nom du restaurant, vos coordonnées et un mot de passe suffisent pour démarrer.",
  },
  {
    question: "SAOVIA Food prélève-t-il une commission sur mes ventes ?",
    answer:
      "Non. SAOVIA Food ne prélève aucune commission sur vos ventes -- vous payez uniquement votre abonnement.",
  },
  {
    question: "Puis-je tester la solution avant de payer ?",
    answer:
      "Oui. Une période d'essai permet de découvrir la plateforme avant de choisir un abonnement.",
  },
  {
    question: "Puis-je créer un QR Code pour mon restaurant ?",
    answer:
      "Oui. Un QR Code propre à votre restaurant est généré automatiquement et permet à vos clients d'accéder directement à votre menu digital.",
  },
  {
    question: "Puis-je suivre mes campagnes Meta ?",
    answer:
      "Oui. Vous pouvez activer votre Meta Pixel depuis votre espace SAOVIA Food afin de faciliter la mesure de vos campagnes Facebook et Instagram.",
  },
  {
    question: "SAOVIA Food aide-t-il pour le référencement ?",
    answer:
      "Votre page publique est structurée pour les principaux moteurs de recherche : SEO technique, métadonnées, sitemap et données de partage adaptées.",
  },
  {
    question: "Puis-je être accompagné pour mes campagnes publicitaires ?",
    answer:
      "Oui. Un accompagnement Meta Ads personnalisé peut être proposé selon l'offre commerciale retenue.",
  },
  {
    question: "SAOVIA Food fonctionne-t-il sur mobile ?",
    answer:
      "Oui. SAOVIA Food est une application web installable (PWA) : votre menu digital, votre vitrine et votre espace de gestion s'utilisent aussi bien sur téléphone, tablette qu'ordinateur.",
  },
  {
    question: "Comment fonctionne le support ?",
    answer:
      "Une équipe est joignable directement par WhatsApp pour vous accompagner au quotidien : configuration, prise en main et conseils personnalisés.",
  },
] as const;

export const Route = createFileRoute("/food")({
  head: () => {
    const canonicalUrl = `${siteOrigin()}/food`;
    const ogImage = `${siteOrigin()}${heroVisualImage}`;

    const softwareJsonLd = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "SAOVIA Food",
      url: canonicalUrl,
      description: DESCRIPTION,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      provider: { "@type": "Organization", name: "SAOVIA", url: siteOrigin() },
    };
    const organizationJsonLd = {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "SAOVIA",
      url: siteOrigin(),
      logo: `${siteOrigin()}${logoMark}`,
    };
    const faqJsonLd = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    };

    return {
      meta: [
        { title: TITLE },
        { name: "description", content: DESCRIPTION },
        { name: "robots", content: "index,follow" },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "SAOVIA" },
        { property: "og:title", content: TITLE },
        { property: "og:description", content: DESCRIPTION },
        { property: "og:url", content: canonicalUrl },
        { property: "og:image", content: ogImage },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: TITLE },
        { name: "twitter:description", content: DESCRIPTION },
        { name: "twitter:image", content: ogImage },
        jsonLdMetaEntry(softwareJsonLd),
        jsonLdMetaEntry(organizationJsonLd),
        jsonLdMetaEntry(faqJsonLd),
      ],
      links: [{ rel: "canonical", href: canonicalUrl }],
    };
  },
  component: FoodLandingPage,
});

function SectionBadge({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">
      {children}
    </p>
  );
}

/** Real, provided product-mockup photos for the "Pourquoi SAOVIA Food ?"
 * feature cards -- the originals are untouched in public/assets/saovia-food/
 * (copied as-is from C:\Users\HP\Downloads\saovia_food_assets\). The
 * "-cutout" files are the same photos with their flat studio-gray/white
 * backdrop actually removed (flood-filled from the border by colour
 * distance, then a 2-3px feather at the boundary for anti-aliasing), never
 * a plain edge fade -- so the subject itself (phone, QR stand, rider,
 * dashboard) stays fully sharp and opaque with no visible rectangle behind
 * it. "promotions.png" is the one exception: its glow blends smoothly into
 * the card face with no hard edge, so flood-fill would eat the card itself
 * -- it keeps a small (~3%) edge-only fade instead. No subject, text,
 * price or rating was cropped, redrawn or altered; see
 * saovia_food_feature_assets/README.txt (a separate, lower-resolution
 * reference/extraction set) for the intended composition this matches --
 * its own README says to prefer the real project assets when they exist,
 * which is what happens here.
 *
 * "livraison"/"livraison-cutout" were replaced with the rider photo supplied
 * in the "Livraison" card reference mockup
 * (C:\Users\HP\Downloads\4830e171-7d2a-4b15-94f1-4132fb3bb7dc.png, cropped to
 * just the rider) -- a light edge-only feather is used here too (not
 * flood-fill), because this photo's helmet and jacket have bright highlights
 * close in tone to its pale background, and flood-fill was bleeding into the
 * helmet itself. */
const FEATURE_VISUAL_SRC: Record<FeatureVisualKind, string> = {
  menu: "/assets/saovia-food/menu-digital-cutout.png",
  qr: "/assets/saovia-food/qr-code-cutout.png",
  orders: "/assets/saovia-food/commandes-cutout.png",
  delivery: "/assets/saovia-food/livraison-cutout.png",
  clients: "/assets/saovia-food/clients-cutout.png",
  promo: "/assets/saovia-food/promotions-cutout.png",
  stats: "/assets/saovia-food/statistiques-cutout.png",
  site: "/assets/saovia-food/site-vitrine-cutout.png",
};

const FEATURE_VISUAL_ALT: Record<FeatureVisualKind, string> = {
  menu: "Menu digital SAOVIA Food affiché sur smartphone",
  qr: "QR Code SAOVIA Food sur un support de table",
  orders: "Liste de commandes avec leurs statuts dans SAOVIA Food",
  delivery: "Livreur SAOVIA Food avec son sac de livraison",
  clients: "Liste de clients et de leurs commandes dans SAOVIA Food",
  promo: "Exemple de code promo SAOVIA Food",
  stats: "Tableau de bord des ventes SAOVIA Food",
  site: "Aperçu d'une page publique de restaurant SAOVIA Food",
};

/** Per-asset visual width, tuned to each subject's own nature rather than
 * one uniform size for all 8 cards: the smartphone reads best tall and
 * fairly large, the QR stand is a compact object that doesn't need to be
 * huge, the interface panels (commandes/clients/site) read as wide product
 * panels, the promo badge is meant to be a dominant graphic, and the
 * statistics panel stays compact-but-legible. "delivery" (Livraison) is the
 * reference finish from the previous pass and is unchanged here. */
const FEATURE_VISUAL_MAX_WIDTH: Record<FeatureVisualKind, string> = {
  menu: "max-w-[46%]",
  qr: "max-w-[40%]",
  orders: "max-w-[46%]",
  delivery: "max-w-[48%]",
  clients: "max-w-[44%]",
  promo: "max-w-[46%]",
  stats: "max-w-[38%]",
  site: "max-w-[42%]",
};

function FeatureVisual({ kind }: { kind: FeatureVisualKind }) {
  return (
    <img
      src={FEATURE_VISUAL_SRC[kind]}
      alt={FEATURE_VISUAL_ALT[kind]}
      loading="lazy"
      decoding="async"
      className={`pointer-events-none absolute bottom-0 right-0 top-0 h-full w-auto ${FEATURE_VISUAL_MAX_WIDTH[kind]} object-contain object-bottom drop-shadow-[0_10px_20px_rgba(26,18,15,0.22)]`}
    />
  );
}

const NAV_LINKS = [
  { label: "Accueil", to: "/food" as const },
  { label: "Fonctionnalités", href: "#fonctionnalites" },
  { label: "Tarifs", href: "#tarifs" },
  { label: "Témoignages", href: "#temoignages" },
  { label: "FAQ", href: "#faq" },
];

function FoodLandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="food-partner-theme min-h-screen bg-background pb-20 text-foreground lg:pb-0">
      {/* ------------------------------------------------------------ Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/food" className="flex items-center gap-2">
            <img src={logoMark} alt="" className="h-8 w-8 rounded-full object-cover" />
            <span className="font-display text-lg font-bold tracking-tight text-foreground">
              SAOVIA
              <span className="ml-1.5 align-middle text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-primary">
                Food
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            {NAV_LINKS.map((link) =>
              link.to ? (
                <Link key={link.label} to={link.to} className="hover:text-foreground">
                  {link.label}
                </Link>
              ) : (
                <a key={link.label} href={link.href} className="hover:text-foreground">
                  {link.label}
                </a>
              ),
            )}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/auth"
              className="hidden items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-accent sm:inline-flex"
            >
              Se connecter
            </Link>
            <Button
              asChild
              size="sm"
              className="hidden h-10 rounded-full px-4 sm:h-9 md:inline-flex"
            >
              <Link to="/food-signup">
                Créer mon restaurant <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </Button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={mobileMenuOpen}
              className="grid h-9 w-9 place-items-center rounded-full border border-border text-foreground md:hidden"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Real mobile menu -- collapsible, not just a shrunk desktop nav. */}
        {mobileMenuOpen && (
          <div className="border-t border-border bg-background px-4 py-4 sm:px-6 md:hidden">
            <nav className="flex flex-col gap-1 text-sm font-medium text-foreground">
              {NAV_LINKS.map((link) =>
                link.to ? (
                  <Link
                    key={link.label}
                    to={link.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-lg px-2 py-2.5 hover:bg-accent"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-lg px-2 py-2.5 hover:bg-accent"
                  >
                    {link.label}
                  </a>
                ),
              )}
            </nav>
            <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
              <Link
                to="/auth"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex h-11 items-center justify-center rounded-full border border-border text-sm font-semibold hover:bg-accent"
              >
                Se connecter
              </Link>
              <Button asChild className="h-11 rounded-full">
                <Link to="/food-signup" onClick={() => setMobileMenuOpen(false)}>
                  Créer mon restaurant <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* -------------------------------------------------------------- Hero
            Immersive full-bleed photo hero: one real photograph (chef,
            laptop + phone showing the SAOVIA Food interface, in a warm
            restaurant kitchen) fills the whole section as a background via
            object-cover, with a left-to-right dark gradient so the text
            column (left) stays readable while the right side of the photo
            stays visible. object-position differs per breakpoint so the
            chef/devices stay in frame instead of being cropped out. A
            curved cream SVG transition at the bottom leads into the
            qualitative trust bar (no fabricated stats -- see note there). */}
        <section className="relative w-full overflow-hidden bg-[#1B140F]">
          {/* Photo box: image + text live in this box only, sized to fully
              contain the photo (min-h, never cropped by anything after
              it). The transition curve below is a normal-flow sibling, not
              an absolutely-positioned overlay, so it can never hide part of
              the photo -- it only adds its own space after the Hero ends. */}
          <div className="relative min-h-[600px] lg:aspect-[3/2] lg:h-auto lg:min-h-[680px]">
            <img
              src={heroImmersiveImage}
              alt="Chef partenaire SAOVIA Food, bras croisés et souriant, avec un ordinateur portable et un smartphone affichant l'interface SAOVIA Food, dans son restaurant"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover object-[68%_14%] sm:object-[64%_18%] lg:object-[56%_22%]"
            />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/10 lg:from-[rgba(0,0,0,0.68)] lg:via-[rgba(0,0,0,0.25)] lg:to-[rgba(0,0,0,0.05)]"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10"
              aria-hidden="true"
            />

            <div className="relative z-10 mx-auto flex h-full max-w-7xl items-center px-4 py-16 sm:px-6 lg:mx-0 lg:max-w-none lg:px-0 lg:py-0">
              <div className="max-w-xs sm:max-w-sm lg:absolute lg:left-[5%] lg:top-1/2 lg:max-w-[560px] lg:-translate-y-1/2">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-accent backdrop-blur">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  {HERO_EYEBROW}
                </span>

                <h1 className="mt-4 text-balance font-sans text-4xl font-extrabold leading-[1.05] text-white sm:text-5xl lg:text-[2.9rem] xl:text-[3.25rem]">
                  Gérez mieux.
                  <br />
                  <span className="text-primary">Vendez plus.</span>
                </h1>

                <p className="mt-4 max-w-sm text-base leading-relaxed text-white/80">
                  Menus, commandes, livraisons et clients : tout au même endroit avec{" "}
                  <span className="font-semibold text-white">SAOVIA Food</span>.
                </p>

                <div className="mt-8">
                  <Button
                    asChild
                    size="lg"
                    className="h-12 w-full max-w-xs rounded-full px-7 text-base sm:w-auto"
                  >
                    <Link to="/food-signup">
                      Créer mon restaurant <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Transition strip into the section below -- normal document
              flow, placed after the photo box ends, so it never overlaps
              the photo. */}
          <svg
            className="block h-10 w-full text-[#FBF3E7] lg:h-14"
            viewBox="0 0 1440 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M0,100 C480,0 960,0 1440,100 L1440,100 L0,100 Z" fill="currentColor" />
          </svg>
        </section>

        {/* ------------------------------------------------------- Fonctionnalités
            Premium card-grid redesign of the feature section (badge/title/
            description copy unchanged from before). Every stat and visual
            here is either a real, shipped capability (see the FEATURES
            comment above) or a deliberately generic illustration -- no
            invented restaurant names, ratings, review counts or revenue
            figures anywhere, unlike the numbers in the supplied reference
            mockup ("+500 restaurants", "4,8/5 avis clients", "Le Goût
            d'Abidjan / 4.8 (245 avis)"), which this project's own data
            (a handful of tenants) does not support. The bottom trust bar
            below states real, honest claims instead (0% commission, fast
            setup, dedicated support). */}
        <section
          id="fonctionnalites"
          className="relative overflow-hidden bg-background pb-28 pt-14 sm:pb-32 sm:pt-16 lg:pb-40 lg:pt-24"
        >
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
          >
            <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-[110px]" />
            <div className="absolute -right-24 top-1/3 h-72 w-72 rounded-full bg-accent/60 blur-[110px]" />
          </div>

          {/* Decorative leaves in the top-left corner -- very light, purely ambient. */}
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute -left-3 -top-3 h-16 w-16 text-emerald-800/20"
            viewBox="0 0 64 64"
            fill="currentColor"
          >
            <path d="M8 56C8 32 24 8 56 8c0 24-16 40-40 48-4-2-8-2-8 0z" />
          </svg>
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute left-16 top-28 hidden h-9 w-9 -rotate-12 text-emerald-800/15 lg:block"
            viewBox="0 0 64 64"
            fill="currentColor"
          >
            <path d="M8 56C8 32 24 8 56 8c0 24-16 40-40 48-4-2-8-2-8 0z" />
          </svg>

          {/* Very subtle spice/ingredient sprinkle, bottom-left corner. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-0 hidden h-28 w-28 opacity-30 lg:block"
            style={{
              backgroundImage: "radial-gradient(circle, #8a3b1f 1.5px, transparent 1.5px)",
              backgroundSize: "10px 10px",
              maskImage: "radial-gradient(circle at bottom left, black, transparent 70%)",
            }}
          />

          {/* Food photo peeking from the bottom-right corner -- a real crop
              of the hero photo (never a new, invented image). */}
          <img
            src={featuresCornerImage}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 right-0 hidden h-28 w-48 object-cover opacity-90 sm:block lg:h-36 lg:w-64"
          />
          <p
            aria-hidden="true"
            className="pointer-events-none absolute bottom-32 right-6 hidden -rotate-2 text-right font-display text-lg italic leading-snug text-foreground/70 lg:block lg:bottom-40 xl:right-10"
          >
            Une ville,
            <br />
            mille saveurs !
          </p>

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-[850px]">
                <span className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-primary">
                  <ChefHat className="h-3.5 w-3.5" aria-hidden="true" />
                  Pourquoi SAOVIA Food ?
                </span>
                <h2 className="mt-4 max-w-[800px] text-balance font-display text-3xl font-bold leading-[1.1] text-foreground sm:text-4xl lg:text-[2.75rem]">
                  Tout ce dont vous avez besoin pour développer{" "}
                  <span className="text-primary">votre restaurant</span>
                </h2>
                <p className="mt-4 max-w-[780px] text-base leading-relaxed text-muted-foreground">
                  Une solution complète, simple et puissante, pensée pour les restaurateurs
                  d'aujourd'hui.
                </p>
              </div>

              <p
                aria-hidden="true"
                className="hidden shrink-0 -rotate-2 pr-2 text-right font-display text-xl italic leading-snug text-foreground/80 lg:block"
              >
                Plus qu'un logiciel,
                <br />
                un partenaire de croissance !
                <svg
                  className="ml-auto mt-1 h-3 w-32 text-primary"
                  viewBox="0 0 120 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 8 Q 30 2 60 7 T 118 5"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </p>
            </div>

            <div className="relative mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="relative overflow-hidden rounded-[22px] border border-border/70 bg-card p-5 shadow-[0_14px_34px_-18px_rgba(26,18,15,0.35)] sm:min-h-[250px] lg:min-h-[270px]"
                >
                  <span className="grid h-[52px] w-[52px] place-items-center rounded-full bg-accent text-primary">
                    <feature.icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h3 className="relative z-10 mt-4 max-w-[45%] text-lg font-bold leading-snug text-foreground">
                    {feature.title}
                  </h3>
                  <p className="relative z-10 mt-1.5 max-w-[45%] text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                  <span
                    aria-hidden="true"
                    className="relative z-10 mt-4 grid h-8 w-8 place-items-center rounded-full border border-primary/40 text-primary"
                  >
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <FeatureVisual kind={feature.visual} />
                </div>
              ))}
            </div>

            <div className="relative mt-14 flex flex-col items-center gap-6 border-t border-accent pt-8 sm:flex-row sm:justify-center sm:gap-0 sm:divide-x sm:divide-accent">
              {[
                { icon: Percent, value: "0 % de commission", text: "sur toutes vos ventes" },
                { icon: Zap, value: "Mise en place rapide", text: "en quelques minutes" },
                { icon: Heart, value: "Une équipe", text: "toujours à vos côtés" },
              ].map((item) => (
                <div key={item.value} className="flex items-center gap-3 px-8 first:pl-0 last:pr-0">
                  <item.icon className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
                  <p className="text-left leading-tight">
                    <span className="block font-bold text-foreground">{item.value}</span>
                    <span className="block text-sm text-muted-foreground">{item.text}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- Marketing */}
        <section className="border-y border-border bg-secondary/40">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-16">
            <div className="max-w-2xl">
              <SectionBadge>Visibilité</SectionBadge>
              <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
                Votre restaurant prêt pour la publicité et le référencement
              </h2>
              <p className="mt-3 text-base text-muted-foreground">
                SAOVIA Food intègre les outils essentiels pour améliorer votre visibilité et mesurer
                vos campagnes.
              </p>
            </div>
            <div className="mt-9 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {MARKETING_ITEMS.map((item) => (
                <div key={item.title} className="rounded-2xl border border-border bg-card p-5">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-accent text-primary">
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-semibold">{item.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------- Zéro commission */}
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-16">
          <div className="grid items-center gap-10 rounded-[2rem] border border-border bg-card p-8 sm:p-10 lg:grid-cols-2 lg:p-14">
            <div>
              <SectionBadge>Modèle commercial</SectionBadge>
              <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
                Vos ventes restent vos ventes.
              </h2>
              <p className="mt-3 text-base text-muted-foreground">
                Avec SAOVIA Food, aucune commission n'est prélevée sur chaque commande.
              </p>
              <div className="mt-7">
                <Button asChild size="lg" className="h-12 rounded-full px-7 text-base">
                  <Link to="/food-signup">
                    Commencer mon essai <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </div>
            <ul className="space-y-3.5">
              {[
                "0 % de commission sur vos ventes",
                "Un abonnement simple après la période d'essai",
                "Pas de prélèvement proportionnel sur votre chiffre d'affaires",
                "Vous gardez le contrôle de votre activité",
              ].map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-3 rounded-2xl border border-border bg-background p-4"
                >
                  <CheckCircle2
                    className="mt-0.5 h-5 w-5 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* -------------------------------------------------------------- QR Code */}
        <section className="border-y border-border bg-background">
          <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:py-16">
            {/* Mobile DOM order is texte -> image -> cta (grid-cols-1 by default,
                no order override); at lg the image moves to its own column
                spanning both rows so texte+cta stay stacked on the left. */}
            <div className="lg:col-start-1 lg:row-start-1">
              <SectionBadge>Menu digital</SectionBadge>
              <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
                Un scan. Votre menu s'ouvre.
              </h2>
              <p className="mt-3 max-w-md text-base text-muted-foreground">
                Affichez votre QR Code sur vos tables, flyers, emballages ou réseaux sociaux. Vos
                clients scannent et accèdent directement à votre menu digital.
              </p>
            </div>

            <div className="relative flex justify-center lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <div
                aria-hidden="true"
                className="absolute inset-0 -z-10 m-auto h-[85%] w-[85%] max-w-[480px] rounded-full bg-primary/15 blur-3xl"
              />
              <img
                src={qrPosterImage}
                alt="Affiche QR Code SAOVIA Food permettant d'accéder au menu digital d'un restaurant"
                loading="lazy"
                className="w-full max-w-[560px] rounded-3xl object-contain shadow-2xl"
              />
            </div>

            <div className="lg:col-start-1 lg:row-start-2">
              <Button
                asChild
                size="lg"
                className="h-12 w-full rounded-full px-7 text-base sm:w-auto"
              >
                <Link to="/food-signup">Créer mon menu digital</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------------- Support */}
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-16">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div>
              <SectionBadge>Accompagnement</SectionBadge>
              <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
                Vous n'êtes pas seul.
              </h2>
              <p className="mt-3 text-base text-muted-foreground">
                SAOVIA Food vous accompagne dans la prise en main de la plateforme, la configuration
                de votre restaurant et, selon vos besoins, votre stratégie de visibilité digitale.
              </p>
            </div>
            <ul className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {[
                "Support technique",
                "Aide à la configuration",
                "Accompagnement à la prise en main",
                "Conseils personnalisés",
                "Accompagnement Meta Ads sur mesure",
              ].map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4"
                >
                  <ShieldCheck
                    className="mt-0.5 h-5 w-5 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------------- Restaurateurs
            Substitutes for a "témoignages" section with named quotes/star
            ratings -- there is no real customer-testimonial data for SAOVIA
            Food anywhere in this project (only per-restaurant customer
            reviews of tenants, a different, private dataset), and inventing
            one ("Chef Mariam", 5-star ratings, etc.) would misrepresent the
            product. This covers the same "why restaurateurs trust us" slot
            with real, verifiable benefits instead. */}
        <section id="temoignages" className="border-y border-border bg-secondary/40">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
            <div className="order-2 flex justify-center lg:order-1">
              <img
                src={chefPortraitImage}
                alt="Chef partenaire SAOVIA Food, bras croisés, souriant dans son restaurant"
                loading="lazy"
                decoding="async"
                className="h-auto w-full max-w-sm object-contain drop-shadow-2xl"
              />
            </div>
            <div className="order-1 lg:order-2">
              <SectionBadge>Pensé pour les restaurateurs</SectionBadge>
              <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
                Vous cuisinez. SAOVIA Food s'occupe du reste.
              </h2>
              <p className="mt-3 text-base text-muted-foreground">
                Concentrez-vous sur ce que vous faites de mieux : créer de bonnes expériences
                culinaires.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Moins de tâches administratives",
                  "Plus de visibilité sur votre activité",
                  "Commandes centralisées",
                  "Livraisons mieux organisées",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <CheckCircle2
                      className="mt-0.5 h-5 w-5 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    <span className="text-sm font-medium">{point}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-7">
                <Button asChild size="lg" className="h-12 rounded-full px-7 text-base">
                  <a href="#fonctionnalites">Découvrir SAOVIA Food</a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ Comment ça marche */}
        <section id="comment-ca-marche" className="border-y border-border bg-secondary/40">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-16">
            <div className="max-w-2xl">
              <SectionBadge>Simple comme bonjour</SectionBadge>
              <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
                De votre inscription à votre première commande
              </h2>
            </div>
            <div className="mt-9 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {HOW_IT_WORKS.map((step) => (
                <div key={step.number} className="rounded-2xl border border-border bg-card p-5">
                  <span className="font-display text-3xl font-semibold text-primary/50">
                    {step.number}
                  </span>
                  <h3 className="mt-3 font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- Essai */}
        <section className="mx-auto max-w-7xl px-4 py-14 text-center sm:px-6 lg:py-16">
          <ChefHat className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
          <h2 className="mt-4 font-display text-3xl font-semibold sm:text-4xl">
            Essayez avant de vous abonner.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
            Découvrez SAOVIA Food pendant votre période d'essai. À la fin de celle-ci, choisissez
            simplement l'abonnement adapté à votre restaurant.
          </p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Essayez SAOVIA Food et évaluez la solution avant de vous engager sur un abonnement.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="h-12 rounded-full px-7 text-base">
              <Link to="/food-signup">
                Démarrer mon essai <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 rounded-full px-7 text-base"
            >
              <a href={ADVISOR_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                Parler à un conseiller
              </a>
            </Button>
          </div>
        </section>

        {/* ------------------------------------------------------------ Tarifs */}
        <section id="tarifs" className="border-y border-border bg-secondary/40">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-16">
            <div className="max-w-2xl">
              <SectionBadge>Des offres simples</SectionBadge>
              <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
                Choisissez la solution adaptée à votre restaurant
              </h2>
              <p className="mt-3 text-base text-muted-foreground">
                Des offres pensées pour évoluer avec votre activité -- sans commission sur vos
                ventes.
              </p>
            </div>
            <div className="mt-9 grid grid-cols-1 gap-5 lg:grid-cols-3">
              {PRICING_PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative rounded-[1.75rem] border p-7 ${
                    plan.featured ? "border-primary bg-card shadow-md" : "border-border bg-card"
                  }`}
                >
                  {plan.featured && (
                    <span className="absolute -top-3 left-7 rounded-full bg-primary px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-primary-foreground">
                      Recommandé
                    </span>
                  )}
                  <h3 className="font-display text-xl font-semibold">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                  <p className="mt-5 font-display text-2xl font-semibold">{plan.price}</p>
                  <ul className="mt-5 space-y-2.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2.5 text-sm">
                        <CheckCircle2
                          className="h-4 w-4 shrink-0 text-primary"
                          aria-hidden="true"
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    variant={plan.featured ? "default" : "outline"}
                    className="mt-7 h-11 w-full rounded-full"
                  >
                    {plan.external ? (
                      <a href={plan.href} target="_blank" rel="noopener noreferrer">
                        {plan.cta}
                      </a>
                    ) : (
                      <Link to={plan.href}>{plan.cta}</Link>
                    )}
                  </Button>
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Tarifs communiqués sur devis, selon les besoins de votre restaurant.
            </p>
          </div>
        </section>

        {/* --------------------------------------------------------------- FAQ */}
        <section id="faq" className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:py-20">
          <div className="text-center">
            <SectionBadge>FAQ</SectionBadge>
            <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
              Les questions que vous vous posez
            </h2>
          </div>
          <Accordion type="single" collapsible className="mt-9">
            {FAQ.map((item) => (
              <AccordionItem key={item.question} value={item.question}>
                <AccordionTrigger className="text-left text-base font-semibold">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* ---------------------------------------------------------- Final CTA */}
        <section className="border-t border-border bg-cocoa">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.3fr_1fr]">
            <div className="text-center lg:text-left">
              <h2 className="font-display text-3xl font-semibold text-cocoa-foreground sm:text-4xl">
                Rejoignez la nouvelle génération de restaurateurs !
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base text-cocoa-foreground/75 lg:mx-0">
                Digitalisez votre activité dès aujourd'hui et offrez une meilleure expérience à vos
                clients.
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                <Button asChild size="lg" className="h-12 rounded-full px-7 text-base">
                  <Link to="/food-signup">
                    Créer mon restaurant <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <p className="inline-flex items-center gap-1.5 text-sm font-medium text-cocoa-foreground/70">
                  <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
                  Installation en quelques minutes
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-6 border-t border-cocoa-foreground/15 pt-8 lg:justify-start lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
              {[
                { icon: Settings, label: "Simple" },
                { icon: Zap, label: "Rapide" },
                { icon: Heart, label: "Efficace" },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center gap-2">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-cocoa-foreground/10 text-cocoa-foreground">
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-semibold text-cocoa-foreground/80">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ Footer
            Extra /food-specific marketing links, kept out of the shared
            PublicFooter component (used across tenant storefronts and every
            other public page, which shouldn't carry SAOVIA-Food-only nav
            like "Tarifs"/"FAQ") -- PublicFooter below still provides the
            actual copyright/WhatsApp-support line for every page. */}
        <section className="border-t border-cocoa-foreground/15 bg-cocoa">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
              <div className="col-span-2 sm:col-span-1">
                <Link to="/food" className="inline-flex items-center gap-2">
                  <img src={logoMark} alt="" className="h-8 w-8 rounded-full object-cover" />
                  <span className="font-display text-base font-bold text-cocoa-foreground">
                    SAOVIA Food
                  </span>
                </Link>
                <p className="mt-2 text-xs text-cocoa-foreground/60">
                  La solution digitale des restaurants.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-cocoa-foreground/50">
                  Produit
                </p>
                <ul className="mt-3 space-y-2 text-sm text-cocoa-foreground/75">
                  <li>
                    <a href="#fonctionnalites" className="hover:text-cocoa-foreground">
                      Fonctionnalités
                    </a>
                  </li>
                  <li>
                    <a href="#tarifs" className="hover:text-cocoa-foreground">
                      Tarifs
                    </a>
                  </li>
                  <li>
                    <a href="#faq" className="hover:text-cocoa-foreground">
                      FAQ
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-cocoa-foreground/50">
                  Entreprise
                </p>
                <ul className="mt-3 space-y-2 text-sm text-cocoa-foreground/75">
                  <li>
                    <Link to="/food" className="hover:text-cocoa-foreground">
                      Accueil
                    </Link>
                  </li>
                  <li>
                    <a
                      href={ADVISOR_WHATSAPP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-cocoa-foreground"
                    >
                      Contact
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-cocoa-foreground/50">
                  Support
                </p>
                <ul className="mt-3 space-y-2 text-sm text-cocoa-foreground/75">
                  <li>
                    <Link to="/auth" className="hover:text-cocoa-foreground">
                      Se connecter
                    </Link>
                  </li>
                  <li>
                    <a
                      href={ADVISOR_WHATSAPP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-cocoa-foreground"
                    >
                      Parler à un conseiller
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />

      {/* Mobile sticky conversion bar -- kept off desktop (lg:hidden) where the
          header's own CTA is always visible; pb-20 on the page wrapper above
          reserves room so this never overlaps the footer/final CTA content. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.12)] backdrop-blur lg:hidden">
        <Button asChild className="h-12 w-full rounded-full text-base">
          <Link to="/food-signup">
            Créer mon restaurant <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

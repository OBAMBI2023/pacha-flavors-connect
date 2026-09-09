import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Bike,
  CheckCircle2,
  ChefHat,
  FlaskConical,
  Heart,
  Megaphone,
  Percent,
  QrCode,
  Quote,
  Rocket,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Store,
  Target,
  Users,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FoodHeader } from "@/components/FoodHeader";
import { FoodFooter } from "@/components/FoodFooter";
import { jsonLdMetaEntry, siteOrigin } from "@/lib/seo";
import { buildWhatsAppUrl, SAOVIA_SUPPORT_WHATSAPP_NUMBER } from "@/lib/whatsapp";
import logoMark from "@/assets/saovia-food-logo.png";
import menuDigitalShowcaseImage from "@/assets/saovia-food-menu-digital-showcase.png";
import heroVisualImage from "@/assets/saovia-food-hero-visual.jpg";
import heroImmersiveImage from "@/assets/saovia-food-hero-immersive.jpg";
import featuresCornerImage from "@/assets/saovia-food-features-corner.png";
import faqPlateImage from "@/assets/saovia-food-auth-hero.png";
import testimonialFatouPortrait from "@/assets/saovia-food-testimonial-fatou-portrait.jpg";
import testimonialLeGoutDabidjanLogo from "@/assets/saovia-food-testimonial-legout-dabidjan-logo.jpg";

const TITLE = "SAOVIA Food | Logiciel restaurant sans commission";
const DESCRIPTION =
  "Digitalisez votre restaurant avec SAOVIA Food : menu digital, commandes, QR Code, clients, livraisons, promotions, Meta Pixel et statistiques, sans commission sur vos ventes.";

// The primary "Créer mon restaurant" CTA routes to the real /food-signup
// account-creation form (see src/routes/food-signup.tsx) -- WhatsApp below
// is only ever the secondary sales path now (the advisor link moved into
// the shared FoodFooter component).
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

/** Real customer testimonial (Fatou S., propriétaire du restaurant "Le
 * Goût d'Abidjan", Abidjan) -- name, photo, restaurant and figures
 * confirmed by the SAOVIA Food team, not illustrative/placeholder copy. */
const TESTIMONIAL_BENEFITS = [
  { icon: Megaphone, label: "Promotion de vos plats" },
  { icon: BarChart3, label: "Meilleur référencement" },
  { icon: Users, label: "Une équipe à vos côtés" },
  { icon: Rocket, label: "Plus de visibilité" },
] as const;

/** Real, current SAOVIA Food pricing (FCFA/month) -- Pro stays "Sur devis"
 * since it's a custom/negotiated offer, never a fabricated number. */
const PRICING_PLANS = [
  {
    icon: Zap,
    name: "Starter",
    description: "Pour démarrer votre présence digitale.",
    price: "10 000",
    period: "FCFA / mois",
    badge: null,
    features: ["Menu digital", "QR Code automatique", "Commandes en ligne", "Support par email"],
    cta: "Commencer maintenant",
    href: "/food-signup",
    external: false,
    featured: false,
    tagline: "Idéal pour lancer votre restaurant en ligne rapidement.",
  },
  {
    icon: BarChart3,
    name: "Business",
    description: "Pour piloter votre activité au quotidien.",
    price: "20 000",
    period: "FCFA / mois",
    badge: "LE PLUS CHOISI",
    features: [
      "Tout le Starter",
      "Gestion des livraisons",
      "Gestion des clients",
      "Promotions et réductions",
      "Statistiques avancées",
      "Support prioritaire",
    ],
    cta: "Commencer maintenant",
    href: "/food-signup",
    external: false,
    featured: true,
    tagline: "Le choix des restaurateurs qui veulent tout piloter.",
  },
  {
    icon: Target,
    name: "Pro",
    description: "Une solution sur mesure pour vos ambitions.",
    price: "Sur devis",
    period: null,
    badge: null,
    features: [
      "Tout le Business",
      "Meta Pixel et suivi des conversions",
      "Accompagnement Meta Ads",
      "Intégrations personnalisées",
      "Support dédié",
      "Formation et conseil",
    ],
    cta: "Nous contacter",
    href: SALES_WHATSAPP_URL,
    external: true,
    featured: false,
    tagline: "Pour les enseignes ambitieuses avec des besoins sur mesure.",
  },
] as const;

const PRICING_BENEFITS = [
  { icon: ShieldCheck, title: "Aucun engagement", description: "Annulez quand vous voulez." },
  { icon: Percent, title: "Aucune commission", description: "0 % sur vos ventes." },
  { icon: Heart, title: "Support local", description: "Une équipe à vos côtés." },
  { icon: Sparkles, title: "Une solution qui grandit", description: "Avec votre restaurant." },
] as const;

const FAQ = [
  {
    icon: Store,
    question: "Comment créer mon restaurant ?",
    answer:
      "Créez votre compte, renseignez les informations de votre établissement et commencez à ajouter vos plats.",
  },
  {
    icon: Percent,
    question: "SAOVIA Food prélève-t-il une commission sur mes ventes ?",
    answer: "Non. SAOVIA Food ne prélève aucune commission sur vos ventes. Vous gardez 100 % de vos revenus.",
  },
  {
    icon: FlaskConical,
    question: "Puis-je tester la solution avant de payer ?",
    answer: "Oui. Testez gratuitement la plateforme avant de choisir votre abonnement.",
  },
  {
    icon: QrCode,
    question: "Puis-je créer un QR Code pour mon restaurant ?",
    answer: "Oui. Un QR Code unique est généré automatiquement pour votre restaurant.",
  },
  {
    icon: Megaphone,
    question: "Puis-je suivre mes campagnes Meta ?",
    answer: "Oui. Suivez vos campagnes Facebook et Instagram avec des statistiques claires.",
  },
  {
    icon: BarChart3,
    question: "SAOVIA Food aide-t-il pour le référencement ?",
    answer:
      "Oui. Votre vitrine, votre menu en ligne et vos outils marketing sont optimisés pour améliorer votre visibilité.",
  },
  {
    icon: Smartphone,
    question: "SAOVIA Food fonctionne-t-il sur mobile ?",
    answer: "Oui. La plateforme est responsive et accessible depuis ordinateur, tablette et smartphone.",
  },
  {
    icon: Settings,
    question: "Comment fonctionne le support ?",
    answer: "Notre équipe est disponible par chat, email et téléphone.",
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


function FoodLandingPage() {
  return (
    <div className="food-partner-theme min-h-screen bg-background pb-20 text-foreground lg:pb-0">
      <FoodHeader activePath="/food" />

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
              the photo -- it only adds its own space after the Hero ends.
              Below lg, this box is a flex column with the content pinned to
              its bottom edge (justify-end): the chef's face sits in the
              image's upper ~40%, so anchoring text to the lower, darker,
              already-gradiented zone (food/laptop/apron) keeps it off the
              face without any absolute/translate/negative-margin trick --
              min-h floors this box's height, which makes justify-end a
              genuine, spec-correct bottom alignment. At lg the desktop
              layout (absolute + translate, vertically centered) is
              untouched via lg:block undoing the flex. */}
          <div className="relative flex min-h-[640px] flex-col justify-end lg:block lg:aspect-[3/2] lg:h-auto lg:min-h-[680px]">
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
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/15"
              aria-hidden="true"
            />

            <div className="relative z-10 mx-auto flex h-full max-w-7xl items-center px-4 py-14 sm:px-6 sm:py-16 lg:mx-0 lg:max-w-none lg:px-0 lg:py-0">
              <div className="max-w-xs sm:max-w-sm lg:absolute lg:left-[5%] lg:top-1/2 lg:max-w-[560px] lg:-translate-y-1/2">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-accent backdrop-blur">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  {HERO_EYEBROW}
                </span>

                <h1 className="mt-5 text-balance font-sans text-4xl font-extrabold leading-[1.05] text-white sm:text-5xl lg:text-[2.9rem] xl:text-[3.25rem]">
                  Gérez mieux.
                  <br />
                  <span className="text-primary">Vendez plus.</span>
                </h1>

                <p className="mt-3.5 max-w-sm text-base leading-relaxed text-white/80">
                  Menus, commandes, livraisons et clients : tout au même endroit avec{" "}
                  <span className="font-semibold text-white">SAOVIA Food</span>.
                </p>

                <div className="mt-7 sm:mt-8">
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
            className="block h-12 w-full text-[#FBF3E7] lg:h-14"
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

        {/* --------------------------------------------------------- Témoignage */}
        <section id="temoignages" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <SectionBadge>Témoignage client</SectionBadge>
            <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
              Ils ont fait le choix de SAOVIA Food
            </h2>
          </div>

          <div className="mx-auto mt-10 overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm">
            <div className="grid lg:grid-cols-[0.8fr_1.2fr]">
              {/* Restaurateur: photo + logo + identity, pinned to the
                  bottom of the panel like the Hero/FAQ photo cards
                  elsewhere on this page. */}
              <div className="relative flex min-h-[420px] flex-col justify-end overflow-hidden bg-cocoa p-6 sm:p-8 lg:min-h-[560px] lg:p-10">
                <img
                  src={testimonialFatouPortrait}
                  alt="Fatou S., propriétaire du restaurant Le Goût d'Abidjan, à Abidjan"
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover object-top"
                />
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10"
                  aria-hidden="true"
                />
                <img
                  src={testimonialLeGoutDabidjanLogo}
                  alt="Logo du restaurant Le Goût d'Abidjan"
                  loading="lazy"
                  className="relative z-10 h-16 w-16 rounded-full object-cover ring-2 ring-white/70 shadow-lg sm:h-20 sm:w-20"
                />
                <div className="relative z-10 mt-4">
                  <p className="font-display text-lg font-semibold text-white">Fatou S.</p>
                  <p className="text-sm text-white/75">Propriétaire, Le Goût d'Abidjan</p>
                  <p className="mt-1 text-xs text-white/60">Abidjan, Côte d'Ivoire</p>
                </div>
              </div>

              {/* Quote, before/after proof and CTA */}
              <div className="p-6 sm:p-8 lg:p-10">
                <Quote className="h-8 w-8 text-primary/30" aria-hidden="true" />
                <blockquote className="mt-2 space-y-3 text-base leading-relaxed text-foreground">
                  <p>
                    Avant, je travaillais avec des partenaires internationaux qui me
                    prélevaient <span className="font-semibold text-destructive">35 % de commission</span> sur
                    chaque commande. C'était énorme !
                  </p>
                  <p>
                    Aujourd'hui, avec SAOVIA Food, je garde mes revenus sur mes commandes :{" "}
                    <span className="font-semibold text-primary">aucune commission</span>,
                    simplement un abonnement pouvant aller jusqu'à{" "}
                    <span className="font-semibold text-primary">20 000 F par mois</span>.
                  </p>
                  <p>
                    Mon chiffre d'affaires atteint{" "}
                    <span className="font-semibold text-primary">3 000 000 F</span> et je garde
                    100 % de mes revenus.
                  </p>
                </blockquote>

                <p className="mt-4 rounded-xl border-l-4 border-primary bg-primary/5 p-4 text-sm font-medium italic text-foreground">
                  « J'invite tous les restaurants à tester le logiciel ! »
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-center">
                    <p className="text-xs font-medium text-muted-foreground">Avant</p>
                    <p className="mt-1 font-display text-xl font-bold text-destructive">35 %</p>
                    <p className="text-[0.7rem] text-muted-foreground">de commission</p>
                  </div>
                  <div className="rounded-xl border border-emerald-600/20 bg-emerald-600/5 p-3 text-center">
                    <p className="text-xs font-medium text-muted-foreground">Aujourd'hui</p>
                    <p className="mt-1 font-display text-xl font-bold text-emerald-600">0 %</p>
                    <p className="text-[0.7rem] text-muted-foreground">de commission</p>
                  </div>
                  <div className="rounded-xl border border-border bg-background p-3 text-center">
                    <p className="text-xs font-medium text-muted-foreground">
                      Chiffre d'affaires
                    </p>
                    <p className="mt-1 font-display text-xl font-bold text-foreground">
                      3 000 000 F
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-background p-3 text-center">
                    <p className="text-xs font-medium text-muted-foreground">Abonnement</p>
                    <p className="mt-1 font-display text-xl font-bold text-foreground">
                      20 000 F<span className="text-xs font-normal">/mois</span>
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {TESTIMONIAL_BENEFITS.map((item) => (
                    <div key={item.label} className="flex flex-col items-center gap-1.5 text-center">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
                        <item.icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-7">
                  <Button
                    asChild
                    size="lg"
                    className="h-12 w-full rounded-full px-7 text-base sm:w-auto"
                  >
                    <Link to="/food-signup">
                      Testez SAOVIA Food maintenant{" "}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
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
                src={menuDigitalShowcaseImage}
                alt="Présentation du menu digital SAOVIA Food : support de table avec QR Code à scanner, smartphone affichant le menu et options sur place, livraison, promotions et avis clients"
                loading="lazy"
                className="w-full max-w-[620px] rounded-3xl object-contain object-center shadow-[0_25px_60px_-25px_rgba(26,18,15,0.4)]"
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

        {/* ------------------------------------------------------------ Tarifs */}
        <section id="tarifs" className="border-y border-border bg-secondary/40">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-16">
            <div className="max-w-2xl">
              <SectionBadge>Des offres simples</SectionBadge>
              <h2 className="mt-3 text-balance font-display text-3xl font-bold leading-[1.1] sm:text-4xl lg:text-[2.75rem]">
                Des offres pensées pour évoluer avec <span className="text-primary">votre activité</span>
              </h2>
              <p className="mt-3 text-lg font-medium text-muted-foreground sm:text-xl">
                Sans commission sur vos ventes.
              </p>
            </div>
            <div className="mt-9 grid grid-cols-1 gap-5 lg:grid-cols-3">
              {PRICING_PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative flex h-full flex-col rounded-[24px] border bg-card p-7 transition-all duration-300 hover:-translate-y-1 sm:p-8 ${
                    plan.featured
                      ? "border-primary/35 bg-gradient-to-b from-accent/40 to-card shadow-[0_18px_44px_-16px_rgba(255,90,0,0.22)] hover:shadow-[0_24px_56px_-16px_rgba(255,90,0,0.28)]"
                      : "border-black/[0.08] shadow-[0_10px_32px_-16px_rgba(20,10,5,0.1)] hover:shadow-[0_16px_40px_-16px_rgba(20,10,5,0.14)]"
                  }`}
                >
                  {plan.badge && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-4 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-primary-foreground shadow-sm">
                      {plan.badge}
                    </span>
                  )}

                  <span className="grid h-11 w-11 place-items-center rounded-full bg-accent text-primary">
                    <plan.icon className="h-5 w-5" aria-hidden="true" />
                  </span>

                  <h3 className="mt-4 font-display text-xl font-semibold">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>

                  <div className="mt-5 flex items-baseline gap-1.5">
                    <span className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-[2.75rem]">
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-sm font-medium text-muted-foreground">
                        {plan.period}
                      </span>
                    )}
                  </div>

                  <ul className="mt-6 space-y-2.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-sm">
                        <CheckCircle2
                          className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                          aria-hidden="true"
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-7">
                    <div className="border-t border-black/[0.06] pt-6">
                      <Button
                        asChild
                        variant={plan.featured ? "default" : "outline"}
                        className={`h-11 w-full rounded-full transition-all duration-200 ${
                          plan.featured
                            ? ""
                            : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                        }`}
                      >
                        {plan.external ? (
                          <a href={plan.href} target="_blank" rel="noopener noreferrer">
                            {plan.cta}
                          </a>
                        ) : (
                          <Link to={plan.href}>{plan.cta}</Link>
                        )}
                      </Button>
                      <p className="mt-3 text-center text-xs text-muted-foreground">
                        {plan.tagline}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-9 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {PRICING_BENEFITS.map((benefit) => (
                <div
                  key={benefit.title}
                  className="rounded-2xl border border-black/[0.06] bg-card p-5 shadow-[0_6px_20px_-12px_rgba(20,10,5,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-12px_rgba(20,10,5,0.14)]"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-accent text-primary">
                    <benefit.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-semibold">{benefit.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------------- FAQ */}
        <section
          id="faq"
          className="relative mx-auto max-w-[1200px] overflow-hidden px-4 py-14 sm:px-6 lg:py-20"
        >
          {/* Discreet premium-SaaS decorations: a huge, near-invisible "?"
              watermark and a soft orange blur -- both aria-hidden,
              pointer-events-none, and placed before the real content in the
              DOM so they always paint behind it and never affect
              readability or the accordion's own layout/functionality. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-8 -top-14 select-none font-display text-[220px] font-bold leading-none text-primary/[0.05] sm:text-[280px] lg:-right-12 lg:-top-20 lg:text-[340px]"
          >
            ?
          </span>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-16 top-1/3 h-56 w-56 rounded-full bg-primary/[0.06] blur-[100px]"
          />

          <div className="relative mx-auto max-w-2xl text-center">
            <SectionBadge>FAQ</SectionBadge>
            <h2 className="mt-3 font-display text-3xl font-bold leading-[1.1] sm:text-4xl lg:text-[2.75rem]">
              Les questions que vous <span className="text-primary">vous posez</span>
            </h2>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              Vous avez une question ? Voici les réponses aux questions les plus fréquentes sur
              SAOVIA Food. Et si vous ne trouvez pas ce que vous cherchez, notre équipe est là
              pour vous.
            </p>
          </div>

          <Accordion
            type="single"
            collapsible
            defaultValue={FAQ[0].question}
            className="relative mx-auto mt-10 flex max-w-3xl flex-col gap-4"
          >
            {FAQ.map((item) => (
              <AccordionItem
                key={item.question}
                value={item.question}
                className="rounded-[18px] border border-black/[0.08] bg-card px-5 shadow-[0_4px_20px_-6px_rgba(20,10,5,0.06)] transition-all duration-200 hover:border-primary/25 hover:shadow-[0_8px_26px_-8px_rgba(20,10,5,0.1)] data-[state=open]:border-primary/30 data-[state=open]:bg-accent data-[state=open]:shadow-[0_10px_32px_-10px_rgba(255,90,0,0.15)]"
              >
                <AccordionTrigger className="gap-3 py-5 text-left text-sm font-semibold hover:text-primary hover:no-underline sm:text-base">
                  <span className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <item.icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    {item.question}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pl-12 text-sm leading-relaxed text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {/* Inline CTA banner, distinct from the page's final CTA section
              below -- a compact nudge right where a visitor who just read
              the FAQ is most likely to convert. */}
          <div className="relative mt-10 overflow-hidden rounded-[18px] border border-black/[0.08] bg-card shadow-[0_10px_36px_-12px_rgba(20,10,5,0.1)]">
            <div className="grid gap-6 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-6 sm:p-6">
              <img
                src={faqPlateImage}
                alt=""
                aria-hidden="true"
                loading="lazy"
                className="hidden h-full w-40 rounded-2xl object-cover sm:block"
              />
              <div className="px-6 pt-6 sm:p-0">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-primary">
                  <Rocket className="h-3 w-3" aria-hidden="true" />
                  Prêt à vous lancer ?
                </span>
                <h3 className="mt-3 font-display text-xl font-semibold sm:text-2xl">
                  Rejoignez les restaurants qui grandissent avec SAOVIA Food.
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Créez votre restaurant en quelques minutes et commencez à attirer plus de
                  clients dès aujourd'hui.
                </p>
              </div>
              <div className="flex flex-col items-start gap-3 px-6 pb-6 sm:items-end sm:p-0">
                <Button asChild size="lg" className="h-12 w-full rounded-full px-7 text-base sm:w-auto">
                  <Link to="/food-signup">
                    Créer mon restaurant <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs font-medium text-muted-foreground">
                  {["Simple", "Rapide", "Sécurisé"].map((advantage) => (
                    <span key={advantage} className="inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      {advantage}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Shared dark "premium SaaS" footer -- see src/components/FoodFooter.tsx */}
        <FoodFooter />
      </main>

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

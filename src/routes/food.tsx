import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Bike, MessageCircle, QrCode, Store, Users, Wallet, Percent } from "lucide-react";
import { PublicFooter } from "@/components/PublicFooter";
import { jsonLdMetaEntry, siteOrigin } from "@/lib/seo";

const TITLE = "SAOVIA Food — Solution SaaS pour la restauration";
const DESCRIPTION =
  "SAOVIA Food est le produit de restauration de SAOVIA : vitrine en ligne, prise de commande, suivi des livraisons et gestion complète pour les restaurants.";

/**
 * Every feature listed here is a real, shipped capability of this codebase
 * (tenant storefronts at /r/:slug, the admin order/dispatch/CRM/marketing/
 * stats modules) -- never aspirational copy. Adding a feature here without
 * it existing in the product would misrepresent SAOVIA Food.
 */
const FEATURES: { icon: typeof Store; title: string; description: string }[] = [
  {
    icon: Store,
    title: "Vitrine en ligne par restaurant",
    description: "Chaque restaurant dispose de sa propre page publique de commande, avec son menu, ses photos et ses informations.",
  },
  {
    icon: Bike,
    title: "Livraison et retrait",
    description: "Prise de commande pour la livraison ou le retrait sur place, avec recherche et suivi du livreur en temps réel.",
  },
  {
    icon: QrCode,
    title: "QR Code sur table",
    description: "Un QR code propre à chaque restaurant pour permettre à un client sur place de consulter le menu et commander directement.",
  },
  {
    icon: Percent,
    title: "Promotions et codes promo",
    description: "Création de codes promo et de promotions pour animer les ventes, avec suivi de leur utilisation réelle.",
  },
  {
    icon: Users,
    title: "Suivi des clients",
    description: "Historique des clients et de leurs commandes pour mieux connaître et fidéliser sa clientèle.",
  },
  {
    icon: MessageCircle,
    title: "Campagnes WhatsApp",
    description: "Envoi de campagnes WhatsApp ciblées vers des segments de clients (réactivation, fidélisation, promotions).",
  },
  {
    icon: BarChart3,
    title: "Statistiques et rapports",
    description: "Tableau de bord des ventes et des commandes, avec export de rapports PDF détaillés.",
  },
  {
    icon: Wallet,
    title: "Suivi financier",
    description: "Suivi des encaissements par méthode de paiement et des remboursements, pour un pilotage clair de l'activité.",
  },
];

export const Route = createFileRoute("/food")({
  head: () => {
    const canonicalUrl = `${siteOrigin()}/food`;
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "SAOVIA Food",
      url: canonicalUrl,
      description: DESCRIPTION,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      provider: { "@type": "Organization", name: "SAOVIA", url: siteOrigin() },
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
        { name: "twitter:card", content: "summary_large_image" },
        jsonLdMetaEntry(jsonLd),
      ],
      links: [{ rel: "canonical", href: canonicalUrl }],
    };
  },
  component: FoodProductPage,
});

function FoodProductPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(185,128,61,0.18),_transparent_30%),linear-gradient(180deg,#fff8ef_0%,#fffdf9_25%,#ffffff_100%)] text-foreground">
      <header className="border-b border-border/70 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="font-display text-2xl font-semibold">
            SAOVIA
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-accent"
          >
            Espace partenaire
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
        <section className="max-w-2xl">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">Un produit SAOVIA</p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-tight sm:text-5xl">SAOVIA Food</h1>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">{DESCRIPTION}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
            >
              Devenir partenaire
            </Link>
            <Link
              to="/restaurants"
              className="inline-flex items-center justify-center rounded-full border border-border px-6 py-3 text-sm font-semibold hover:bg-accent"
            >
              Voir les restaurants sur SAOVIA
            </Link>
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">Ce que propose SAOVIA Food</h2>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-2xl border border-border bg-card p-5">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                  <feature.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-semibold">{feature.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

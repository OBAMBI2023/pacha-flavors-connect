import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, CheckCircle2, ChevronRight, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { FoodHeader } from "@/components/FoodHeader";
import { FoodFooter } from "@/components/FoodFooter";
import { ConseilArticleCard } from "@/components/food/ConseilArticleCard";
import { CATEGORY_TINTS, CONSEIL_ARTICLES, CONSEIL_CATEGORIES } from "@/lib/food-conseils";
import {
  buildBreadcrumbJsonLd,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  jsonLdMetaEntry,
  siteOrigin,
} from "@/lib/seo";
import heroImmersiveImage from "@/assets/saovia-food-hero-immersive.jpg";
import tchep from "@/assets/tchep.jpg";

const TITLE = "Conseils pour restaurateurs | SAOVIA Food";
const DESCRIPTION =
  "Conseils pratiques pour digitaliser votre restaurant, attirer plus de clients et développer votre activité.";

export const Route = createFileRoute("/food_/conseils")({
  head: () => {
    const canonicalUrl = `${siteOrigin()}/food/conseils`;
    const ogImage = `${siteOrigin()}${heroImmersiveImage}`;

    const blogJsonLd = {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "Conseils SAOVIA Food",
      url: canonicalUrl,
      description: DESCRIPTION,
      publisher: { "@type": "Organization", name: "SAOVIA", url: siteOrigin() },
      blogPost: CONSEIL_ARTICLES.map((article) => ({
        "@type": "BlogPosting",
        headline: article.title,
        description: article.description,
        datePublished: article.date,
        dateModified: article.updatedAt,
        url: `${siteOrigin()}/food/conseils/${article.slug}`,
      })),
    };
    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
      { name: "Accueil", url: `${siteOrigin()}/food` },
      { name: "Conseils", url: canonicalUrl },
    ]);

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
        jsonLdMetaEntry(blogJsonLd),
        jsonLdMetaEntry(breadcrumbJsonLd),
        jsonLdMetaEntry(buildOrganizationJsonLd()),
        jsonLdMetaEntry(buildWebSiteJsonLd()),
      ],
      links: [{ rel: "canonical", href: canonicalUrl }],
    };
  },
  component: FoodConseilsPage,
});

function FoodConseilsPage() {
  return (
    <div className="food-partner-theme min-h-screen bg-background text-foreground">
      <FoodHeader activePath="/food/conseils" />

      <main>
        {/* --------------------------------------------------------- Fil d'Ariane */}
        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/food">Accueil</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Conseils</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* ------------------------------------------------------------- Hero */}
        <section className="relative overflow-hidden bg-background">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-[110px]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-primary/[0.07] blur-[110px]"
          />

          <p
            aria-hidden="true"
            className="pointer-events-none absolute left-6 top-24 hidden max-w-[160px] -rotate-3 text-left font-display text-base italic leading-snug text-foreground/60 lg:block xl:left-10"
          >
            La réussite des restaurants commence par le bon conseil !
          </p>
          <p
            aria-hidden="true"
            className="pointer-events-none absolute right-6 top-24 hidden max-w-[160px] rotate-2 text-right font-display text-base italic leading-snug text-foreground/60 lg:block xl:right-10"
          >
            Des idées aujourd'hui, plus de clients demain !
          </p>

          <div className="relative mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 lg:py-20">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-primary">
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              Conseils
            </span>
            <h1 className="mt-4 text-balance font-display text-3xl font-bold leading-[1.1] sm:text-4xl lg:text-[2.75rem]">
              Conseils pour faire grandir <span className="text-primary">votre restaurant</span>
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Conseils pratiques, stratégies digitales et bonnes pratiques pour attirer plus de
              clients et développer votre activité.
            </p>
          </div>
        </section>

        {/* -------------------------------------------------------- Catégories */}
        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:pb-16">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CONSEIL_CATEGORIES.map((category) => {
              const tint = CATEGORY_TINTS[category.tint];
              return (
                <div
                  key={category.slug}
                  className={`group flex items-start gap-3 rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-14px_rgba(20,10,5,0.18)] ${tint.bg}`}
                >
                  <span
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${tint.iconBg} ${tint.iconText}`}
                  >
                    <category.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground">{category.title}</h3>
                    <p className="mt-1 text-sm leading-snug text-muted-foreground">
                      {category.description}
                    </p>
                  </div>
                  <ChevronRight
                    className="mt-1 h-4 w-4 shrink-0 text-foreground/30 transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </div>
              );
            })}
          </div>
        </section>

        {/* --------------------------------------------------- Articles récents */}
        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:pb-20">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h2 className="font-display text-2xl font-bold sm:text-3xl">Articles récents</h2>
              <p className="mt-2 max-w-xl text-base text-muted-foreground">
                Découvrez nos derniers conseils pour faire passer votre restaurant au niveau
                supérieur.
              </p>
            </div>
            <Button
              asChild
              variant="outline"
              className="h-11 w-full shrink-0 rounded-full border-primary/30 bg-primary/10 px-6 text-primary hover:bg-primary/15 sm:w-auto"
            >
              <Link to="/food/conseils">
                Voir tous les conseils <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {CONSEIL_ARTICLES.map((article) => (
              <ConseilArticleCard key={article.slug} article={article} />
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------- CTA */}
        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:pb-20">
          <div className="relative overflow-hidden rounded-[22px] border border-black/[0.08] bg-white shadow-[0_10px_36px_-12px_rgba(20,10,5,0.1)]">
            <div className="grid gap-6 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-6 sm:p-6">
              <img
                src={tchep}
                alt=""
                aria-hidden="true"
                loading="lazy"
                className="hidden h-full w-40 rounded-2xl object-cover sm:block"
              />
              <div className="px-6 pt-6 sm:p-0">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-primary">
                  <Rocket className="h-3 w-3" aria-hidden="true" />
                  Passer à l'action
                </span>
                <h2 className="mt-3 font-display text-xl font-semibold sm:text-2xl">
                  Prêt à faire grandir votre restaurant ?
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Rejoignez les restaurateurs qui font confiance à SAOVIA Food.
                </p>
              </div>
              <div className="flex flex-col items-start gap-3 px-6 pb-6 sm:items-end sm:p-0">
                <Button asChild size="lg" className="h-12 w-full rounded-full px-7 text-base sm:w-auto">
                  <Link to="/food-signup">
                    Créer mon restaurant <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs font-medium text-muted-foreground">
                  {["Simple", "Rapide", "Sécurisé"].map((benefit) => (
                    <span key={benefit} className="inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      {benefit}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <FoodFooter />
      </main>
    </div>
  );
}

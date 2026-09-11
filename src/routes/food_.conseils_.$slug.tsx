import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Calendar, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FoodHeader } from "@/components/FoodHeader";
import { FoodFooter } from "@/components/FoodFooter";
import { ConseilArticleCard } from "@/components/food/ConseilArticleCard";
import {
  CATEGORY_TINTS,
  getArticle,
  getCategory,
  getRelatedArticles,
  type ConseilArticle,
} from "@/lib/food-conseils";
import {
  buildBreadcrumbJsonLd,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  jsonLdMetaEntry,
  siteOrigin,
} from "@/lib/seo";

export const Route = createFileRoute("/food_/conseils_/$slug")({
  loader: ({ params }) => {
    const article = getArticle(params.slug);
    if (!article) throw notFound();
    return { article };
  },
  head: ({ loaderData }) => {
    const article = loaderData?.article as ConseilArticle | undefined;
    if (!article) return {};

    const category = getCategory(article.categorySlug);
    const canonicalUrl = `${siteOrigin()}/food/conseils/${article.slug}`;
    const ogImage = `${siteOrigin()}${article.image}`;
    const hasFaq = article.content.some((block) => block.type === "faq");

    const articleJsonLd = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: article.title,
      description: article.seoDescription,
      datePublished: article.date,
      dateModified: article.updatedAt,
      image: ogImage,
      url: canonicalUrl,
      author: { "@type": "Organization", name: article.author },
      publisher: { "@type": "Organization", name: "SAOVIA", url: siteOrigin() },
      keywords: article.keywords.join(", "),
    };
    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
      { name: "Accueil", url: `${siteOrigin()}/food` },
      { name: category.title, url: `${siteOrigin()}/food/conseils` },
      { name: article.title, url: canonicalUrl },
    ]);
    const faqJsonLd = hasFaq
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: article.content
            .filter((block): block is Extract<typeof block, { type: "faq" }> => block.type === "faq")
            .flatMap((block) =>
              block.items.map((item) => ({
                "@type": "Question",
                name: item.question,
                acceptedAnswer: { "@type": "Answer", text: item.answer },
              })),
            ),
        }
      : null;

    return {
      meta: [
        { title: article.seoTitle },
        { name: "description", content: article.seoDescription },
        { name: "keywords", content: article.keywords.join(", ") },
        { name: "robots", content: "index,follow" },
        { property: "og:type", content: "article" },
        { property: "og:site_name", content: "SAOVIA" },
        { property: "og:title", content: article.seoTitle },
        { property: "og:description", content: article.seoDescription },
        { property: "og:url", content: canonicalUrl },
        { property: "og:image", content: ogImage },
        { property: "article:published_time", content: article.date },
        { property: "article:modified_time", content: article.updatedAt },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: article.seoTitle },
        { name: "twitter:description", content: article.seoDescription },
        { name: "twitter:image", content: ogImage },
        jsonLdMetaEntry(articleJsonLd),
        jsonLdMetaEntry(breadcrumbJsonLd),
        jsonLdMetaEntry(buildOrganizationJsonLd()),
        jsonLdMetaEntry(buildWebSiteJsonLd()),
        ...(faqJsonLd ? [jsonLdMetaEntry(faqJsonLd)] : []),
      ],
      links: [{ rel: "canonical", href: canonicalUrl }],
    };
  },
  notFoundComponent: ArticleNotFound,
  component: ArticlePage,
});

/** Branded 404 for this route specifically (rather than the app-wide
 * generic NotFoundComponent in __root.tsx) -- keeps the /food header,
 * footer and visual identity intact even when a slug doesn't exist, and
 * points back to the real articles list instead of the app root. */
function ArticleNotFound() {
  return (
    <div className="food-partner-theme min-h-screen bg-background text-foreground">
      <FoodHeader activePath="/food/conseils" />
      <main className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
        <span className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-primary">
          404
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">Article introuvable</h1>
        <p className="mt-3 text-base text-muted-foreground">
          Cet article n'existe pas ou a été déplacé. Retrouvez tous nos conseils ci-dessous.
        </p>
        <Button asChild size="lg" className="mt-7 h-12 rounded-full px-7 text-base">
          <Link to="/food/conseils">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Retour aux conseils
          </Link>
        </Button>
      </main>
      <FoodFooter />
    </div>
  );
}

function ArticlePage() {
  const { article } = Route.useLoaderData();
  const category = getCategory(article.categorySlug);
  const tint = CATEGORY_TINTS[category.tint];
  const relatedArticles = getRelatedArticles(article);

  return (
    <div className="food-partner-theme min-h-screen bg-background text-foreground">
      <FoodHeader activePath="/food/conseils" />

      <main>
        <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/food">Accueil</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/food/conseils">Conseils</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="line-clamp-1">{article.title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <Link
            to="/food/conseils"
            className="mt-6 flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Retour aux conseils
          </Link>

          <span
            className={`mt-6 flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[0.7rem] font-semibold ${tint.pillBg} ${tint.pillText}`}
          >
            <category.icon className="h-3 w-3" aria-hidden="true" />
            {category.title}
          </span>

          <h1 className="mt-4 text-balance font-display text-3xl font-bold leading-[1.15] sm:text-4xl">
            {article.title}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            <span>Par {article.author}</span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4" aria-hidden="true" />
              Publié le {article.date}
            </span>
            {article.updatedAt !== article.date && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4" aria-hidden="true" />
                Mis à jour le {article.updatedAt}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" aria-hidden="true" />
              {article.readingTime}
            </span>
          </div>

          <div className="relative mt-8 aspect-video w-full overflow-hidden rounded-[22px] border border-black/[0.08] shadow-[0_10px_36px_-12px_rgba(20,10,5,0.12)]">
            <img src={article.image} alt={article.imageAlt} className="h-full w-full object-cover" />
          </div>

          <div className="mt-10 space-y-5">
            {article.content.map((block, index) => {
              if (block.type === "heading") {
                return (
                  <h2 key={index} className="font-display text-xl font-bold text-foreground sm:text-2xl">
                    {block.text}
                  </h2>
                );
              }
              if (block.type === "list") {
                return (
                  <ul key={index} className="space-y-3">
                    {block.items.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                        <span className="text-base leading-relaxed text-foreground/85">{item}</span>
                      </li>
                    ))}
                  </ul>
                );
              }
              if (block.type === "link") {
                return (
                  <a
                    key={index}
                    href={block.href}
                    className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
                  >
                    {block.text} <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                  </a>
                );
              }
              if (block.type === "faq") {
                return (
                  <div key={index}>
                    <h2 className="font-display text-xl font-bold text-foreground sm:text-2xl">FAQ</h2>
                    <Accordion type="single" collapsible className="mt-3">
                      {block.items.map((item) => (
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
                  </div>
                );
              }
              return (
                <p key={index} className="text-base leading-relaxed text-muted-foreground">
                  {block.text}
                </p>
              );
            })}
          </div>

          {/* Inline CTA, same premium horizontal-card treatment used
              elsewhere across /food -- content/benefits/destination
              unchanged from the listing page's own CTA. Placed before
              "Articles similaires" per the SEO brief. */}
          <div className="mt-12 overflow-hidden rounded-[22px] border border-black/[0.08] bg-card p-7 text-center shadow-[0_10px_36px_-12px_rgba(20,10,5,0.1)] sm:p-8">
            <h2 className="font-display text-xl font-semibold sm:text-2xl">
              Prêt à faire grandir votre restaurant ?
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Rejoignez les restaurateurs qui font confiance à SAOVIA Food.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3">
              <Button asChild size="lg" className="h-12 w-full max-w-xs rounded-full px-7 text-base">
                <Link to="/food-signup">
                  Créer mon restaurant <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 text-xs font-medium text-muted-foreground">
                {["Simple", "Rapide", "Sécurisé"].map((benefit) => (
                  <span key={benefit} className="inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    {benefit}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </article>

        {/* Wider than the article's own max-w-3xl reading column so the
            3-card grid gets the same room it has on the listing page,
            instead of three cramped columns squeezed into prose width. */}
        {relatedArticles.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:pb-20">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Articles similaires</h2>
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {relatedArticles.map((related) => (
                <ConseilArticleCard key={related.slug} article={related} />
              ))}
            </div>
          </section>
        )}

        <FoodFooter />
      </main>
    </div>
  );
}

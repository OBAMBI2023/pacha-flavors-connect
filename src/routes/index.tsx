import { createFileRoute } from "@tanstack/react-router";
import { RestaurantsPage } from "@/routes/restaurants";
import { buildOrganizationJsonLd, siteOrigin } from "@/lib/seo";

// "/" is the SAOVIA Food marketplace homepage: the same generic,
// data-driven restaurant listing as /restaurants (see
// src/routes/restaurants.tsx for the component this reuses), not any single
// tenant's storefront. Tenant storefronts live at /r/$slug.
const TITLE = "SAOVIA Food | Commandez dans vos restaurants préférés à Abidjan";
const DESCRIPTION =
  "Découvrez les restaurants partenaires SAOVIA Food à Abidjan et commandez en ligne : menu digital, livraison et retrait.";

export const Route = createFileRoute("/")({
  head: () => {
    const canonicalUrl = `${siteOrigin()}/`;

    return {
      meta: [
        { title: TITLE },
        { name: "description", content: DESCRIPTION },
        { name: "robots", content: "index,follow" },
        { property: "og:title", content: TITLE },
        { property: "og:description", content: DESCRIPTION },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "SAOVIA" },
        { property: "og:url", content: canonicalUrl },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: TITLE },
        { name: "twitter:description", content: DESCRIPTION },
      ],
      links: [{ rel: "canonical", href: canonicalUrl }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            "@id": canonicalUrl,
            name: "SAOVIA Food",
            url: canonicalUrl,
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify(buildOrganizationJsonLd()),
        },
      ],
    };
  },
  component: Index,
});

function Index() {
  return <RestaurantsPage isHome />;
}

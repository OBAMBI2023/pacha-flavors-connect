import { createFileRoute } from "@tanstack/react-router";
import { CartProvider } from "@/lib/cart";
import { DeliveryLocationProvider } from "@/lib/deliveryLocation";
import { TenantStorefront } from "@/routes/r.$slug";
import { siteOrigin } from "@/lib/seo";
import heroImg from "@/assets/hero.jpg";

// "/" is the default storefront, currently pinned to this one tenant (same
// hardcoded slug the legacy version of this page already passed to every
// section -- not a new assumption). Renders the exact same generic,
// slug-driven TenantStorefront as /r/$slug -- same data fetching (RLS/RPC
// tenant-scoped via useMenuData), same components, same cart/checkout, so
// this page can never diverge from the real storefront again. See
// src/routes/r.$slug.tsx for the component this reuses.
const HOME_TENANT_SLUG = "le-pacha";

const TITLE = "Le Pacha Restaurant | Restaurant à Angré 8e Tranche Abidjan";
const DESCRIPTION =
  "Découvrez Le Pacha Restaurant à Angré 8e Tranche, Abidjan. Cuisine authentique, plats africains, réservation, commande à emporter et livraison.";

export const Route = createFileRoute("/")({
  head: () => {
    const canonicalUrl = `${siteOrigin()}/`;
    const ogImage = `${siteOrigin()}${heroImg}`;

    return {
      meta: [
        { title: TITLE },
        { name: "description", content: DESCRIPTION },
        {
          name: "keywords",
          content:
            "restaurant Angré, restaurant Angré 8e Tranche, restaurant Abidjan, restaurant SICOMEX, livraison repas Angré, restaurant cuisine africaine Abidjan, restaurant ivoirien Abidjan",
        },
        { name: "robots", content: "index,follow" },
        { property: "og:title", content: TITLE },
        { property: "og:description", content: DESCRIPTION },
        { property: "og:type", content: "restaurant" },
        { property: "og:url", content: canonicalUrl },
        { property: "og:image", content: ogImage },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: TITLE },
        { name: "twitter:description", content: DESCRIPTION },
        { name: "twitter:image", content: ogImage },
      ],
      links: [{ rel: "canonical", href: canonicalUrl }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Restaurant",
            "@id": canonicalUrl,
            name: "Le Pacha Restaurant",
            url: canonicalUrl,
            image: ogImage,
            servesCuisine: ["Ivoirienne", "Africaine"],
            telephone: "+2250707170514",
            address: {
              "@type": "PostalAddress",
              streetAddress: "Angré 8e Tranche, Feu du SICOMEX",
              addressLocality: "Abidjan",
              addressCountry: "CI",
            },
          }),
        },
      ],
    };
  },
  component: Index,
});

function Index() {
  return (
    <CartProvider>
      <DeliveryLocationProvider>
        <TenantStorefront slug={HOME_TENANT_SLUG} />
      </DeliveryLocationProvider>
    </CartProvider>
  );
}

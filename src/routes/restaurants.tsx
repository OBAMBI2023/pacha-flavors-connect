import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketplaceShell } from "@/components/marketplace/MarketplaceShell";
import { useMarketplaceRestaurants } from "@/lib/marketplace";

export const Route = createFileRoute("/restaurants")({
  head: () => ({
    meta: [
      { title: "Restaurants et menus | SAOVIA" },
      { name: "description", content: "Découvrez les restaurants disponibles sur SAOVIA." },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "/restaurants" }],
  }),
  component: RestaurantsPage,
});

function RestaurantsPage() {
  const { data, isLoading } = useMarketplaceRestaurants({});
  const restaurants = data?.restaurants ?? [];

  return (
    <MarketplaceShell
      eyebrow="Restaurants"
      title="Tous les restaurants"
      subtitle="Parcourez les restaurants publics, ouvrez une fiche et commandez directement dans SAOVIA."
      searchHref="/rechercher"
      ctas={
        <Link to="/rechercher" className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">
          Rechercher
        </Link>
      }
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-80 animate-pulse rounded-3xl bg-muted" />
            ))
          : restaurants.map((restaurant) => (
              <Link
                key={restaurant.id}
                to="/restaurant/$slug"
                params={{ slug: restaurant.slug }}
                className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm"
              >
                <div className="aspect-[16/10] bg-muted">
                  {restaurant.cover_url ? (
                    <img src={restaurant.cover_url} alt={restaurant.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : null}
                </div>
                <div className="p-5">
                  <h2 className="font-semibold">{restaurant.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{[restaurant.commune, restaurant.city].filter(Boolean).join(", ")}</p>
                </div>
              </Link>
            ))}
      </section>
    </MarketplaceShell>
  );
}

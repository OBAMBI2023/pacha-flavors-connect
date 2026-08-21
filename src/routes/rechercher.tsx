import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MarketplaceShell } from "@/components/marketplace/MarketplaceShell";
import { useMarketplaceRestaurants } from "@/lib/marketplace";

export const Route = createFileRoute("/rechercher")({
  head: () => ({
    meta: [{ title: "Rechercher un restaurant | SAOVIA" }, { name: "robots", content: "index,follow" }],
    links: [{ rel: "canonical", href: "/rechercher" }],
  }),
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useMarketplaceRestaurants({ q });
  const restaurants = data?.restaurants ?? [];
  const empty = useMemo(() => !isLoading && restaurants.length === 0, [isLoading, restaurants.length]);

  return (
    <MarketplaceShell
      eyebrow="Recherche"
      title="Rechercher un restaurant"
      subtitle="Recherche tolérante au texte simple sur les restaurants publics."
      searchHref="/rechercher"
      ctas={<Link to="/restaurants" className="rounded-full border border-border px-5 py-3 text-sm font-semibold">Restaurants</Link>}
    >
      <label className="block rounded-3xl border border-border bg-card p-5 shadow-sm">
        <span className="text-sm font-medium">Nom du restaurant</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ex. Le Pacha"
          className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3 outline-none"
        />
      </label>
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-72 animate-pulse rounded-3xl bg-muted" />
          ))}
        </div>
      ) : empty ? (
        <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-sm text-muted-foreground">
          Aucun restaurant trouvé.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {restaurants.map((restaurant) => (
            <Link
              key={restaurant.id}
              to="/restaurant/$slug"
              params={{ slug: restaurant.slug }}
              className="rounded-3xl border border-border bg-card p-5 shadow-sm"
            >
              <h2 className="font-semibold">{restaurant.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{[restaurant.commune, restaurant.city].filter(Boolean).join(", ")}</p>
            </Link>
          ))}
        </div>
      )}
    </MarketplaceShell>
  );
}

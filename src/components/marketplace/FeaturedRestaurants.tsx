import { Link } from "@tanstack/react-router";
import { Info } from "lucide-react";
import type { MarketplaceRestaurant } from "@/lib/marketplace";

export function FeaturedRestaurants({ restaurants }: { restaurants: MarketplaceRestaurant[] }) {
  if (restaurants.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex items-center gap-1.5">
        <h2 className="text-xl font-bold">Restaurants à la une</h2>
        <Info className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {restaurants.map((restaurant) => (
          <Link
            key={restaurant.id}
            to="/restaurant/$slug"
            params={{ slug: restaurant.slug }}
            className="flex w-[10.3125rem] shrink-0 flex-col overflow-hidden rounded-[1.25rem] border border-border bg-card"
          >
            <div className="flex h-[8.125rem] items-center justify-center bg-white p-4">
              {restaurant.logo_url ? (
                <img src={restaurant.logo_url} alt={restaurant.name} className="h-full w-full object-contain" loading="lazy" />
              ) : (
                <span className="text-sm font-semibold text-muted-foreground">{restaurant.name}</span>
              )}
            </div>
            {restaurant.delivery_fee === 0 ? (
              <span className="mx-3 mb-3 mt-2 self-start rounded-md bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">
                Gratuit
              </span>
            ) : (
              <span className="mx-3 mb-3 mt-2 truncate text-sm font-semibold">{restaurant.name}</span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}

import { Link } from "@tanstack/react-router";
import { Heart, PersonStanding, Truck } from "lucide-react";
import type { MarketplaceRestaurant } from "@/lib/marketplace";

export function RestaurantCard({
  restaurant,
  isFavorite,
  onToggleFavorite,
}: {
  restaurant: MarketplaceRestaurant;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  const location = [restaurant.commune, restaurant.city].filter(Boolean).join(", ");

  return (
    <div>
      <Link to="/restaurant/$slug" params={{ slug: restaurant.slug }} className="relative block">
        <div className="h-[13.75rem] w-full overflow-hidden rounded-[1.375rem] bg-muted">
          {restaurant.cover_url ? (
            <img src={restaurant.cover_url} alt={restaurant.name} className="h-full w-full object-cover" loading="lazy" />
          ) : null}
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            onToggleFavorite();
          }}
          aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          aria-pressed={isFavorite}
          className="absolute right-3 top-3 flex h-[3.125rem] w-[3.125rem] items-center justify-center rounded-full bg-white shadow-md"
        >
          <Heart className={`h-5 w-5 ${isFavorite ? "fill-primary text-primary" : "text-foreground"}`} />
        </button>
      </Link>

      <Link to="/restaurant/$slug" params={{ slug: restaurant.slug }} className="mt-3 block">
        <h3 className="text-[1.3125rem] font-bold uppercase leading-tight">{restaurant.name}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.9375rem] text-muted-foreground">
          {restaurant.delivery_fee === 0 && restaurant.delivery_enabled ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
              <Truck className="h-3.5 w-3.5" />
              Gratuit
            </span>
          ) : null}
          {restaurant.pickup_enabled ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-bold">
              <PersonStanding className="h-3.5 w-3.5" />
              Retrait
            </span>
          ) : null}
          {location ? <span>{location}</span> : null}
        </div>
      </Link>
    </div>
  );
}

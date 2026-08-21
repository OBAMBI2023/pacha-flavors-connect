import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { TopBar } from "@/components/marketplace/TopBar";
import { SearchBar } from "@/components/marketplace/SearchBar";
import { CategoryList } from "@/components/marketplace/CategoryList";
import { FilterBar, type SortOption } from "@/components/marketplace/FilterBar";
import { PromoBanner } from "@/components/marketplace/PromoBanner";
import { FeaturedRestaurants } from "@/components/marketplace/FeaturedRestaurants";
import { CheapMealsSection } from "@/components/marketplace/CheapMealsSection";
import { RestaurantCard } from "@/components/marketplace/RestaurantCard";
import { BottomNav } from "@/components/marketplace/BottomNav";
import { useMarketplaceRestaurants } from "@/lib/marketplace";
import { useFavoriteRestaurants } from "@/lib/favorites";

export const Route = createFileRoute("/restaurants")({
  head: () => ({
    meta: [
      { title: "Restaurants | SAOVIA" },
      { name: "description", content: "Découvrez les restaurants disponibles sur SAOVIA à Abidjan." },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "/restaurants" }],
  }),
  component: RestaurantsPage,
});

function RestaurantsPage() {
  const [q, setQ] = useState("");
  const [dishType, setDishType] = useState<string | null>(null);
  const [pickupOnly, setPickupOnly] = useState(false);
  const [freeDeliveryOnly, setFreeDeliveryOnly] = useState(false);
  const [sort, setSort] = useState<SortOption>("pertinence");

  const { data, isLoading } = useMarketplaceRestaurants({ q });
  const { favorites, toggle } = useFavoriteRestaurants();
  const restaurants = data?.restaurants ?? [];

  const dishTypes = useMemo(() => {
    const set = new Set<string>();
    for (const restaurant of restaurants) {
      for (const type of restaurant.dish_types) set.add(type);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [restaurants]);

  const filtered = useMemo(() => {
    let list = restaurants.filter((restaurant) => {
      if (dishType && !restaurant.dish_types.includes(dishType)) return false;
      if (pickupOnly && !restaurant.pickup_enabled) return false;
      if (freeDeliveryOnly && restaurant.delivery_fee !== 0) return false;
      return true;
    });

    if (sort === "nom-asc") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "nom-desc") list = [...list].sort((a, b) => b.name.localeCompare(a.name));

    return list;
  }, [restaurants, dishType, pickupOnly, freeDeliveryOnly, sort]);

  return (
    <div className="min-h-screen bg-background pb-28 lg:pb-12">
      <div className="mx-auto max-w-lg md:max-w-6xl">
        <TopBar backTo="/" />

        <div className="space-y-5 px-4">
          <h1 className="font-display text-[2rem] font-bold leading-none">Restaurants</h1>

          <SearchBar value={q} onChange={setQ} />

          <CategoryList categories={dishTypes} active={dishType} onSelect={setDishType} />

          <FilterBar
            dishType={dishType}
            onDishTypeChange={setDishType}
            dishTypes={dishTypes}
            pickupOnly={pickupOnly}
            onPickupOnlyChange={setPickupOnly}
            sort={sort}
            onSortChange={setSort}
            freeDeliveryOnly={freeDeliveryOnly}
            onFreeDeliveryOnlyChange={setFreeDeliveryOnly}
          />

          <PromoBanner />

          <FeaturedRestaurants restaurants={restaurants} />
        </div>

        <div className="mt-6">
          <CheapMealsSection />
        </div>

        <div className="px-4 pt-6">
          <h2 className="mb-4 text-xl font-bold">Tous les restaurants</h2>
          {isLoading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-[13.75rem] w-full animate-pulse rounded-[1.375rem] bg-muted" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Aucun restaurant ne correspond à ces filtres.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((restaurant) => (
                <RestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  isFavorite={favorites.includes(restaurant.id)}
                  onToggleFavorite={() => toggle(restaurant.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

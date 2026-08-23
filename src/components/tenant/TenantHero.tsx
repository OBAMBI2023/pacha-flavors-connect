import { MapPin, Phone } from "lucide-react";
import type { PublicRestaurant, PublicRestaurantSettings } from "@/lib/menu-db";
import type { RestaurantAvailability } from "@/lib/businessHours";
import { AvailabilityBadge } from "@/components/tenant/AvailabilityBadge";

function scrollToMenu() {
  document.getElementById("carte")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function TenantHero({
  restaurant,
  availability,
}: {
  restaurant: PublicRestaurant;
  settings: PublicRestaurantSettings | null;
  availability: RestaurantAvailability | null;
}) {
  const location = [restaurant.address, restaurant.commune, restaurant.city].filter(Boolean).join(", ");
  const hasCover = Boolean(restaurant.cover_url);

  return (
    <section id="accueil" className="bg-background pt-1">
      <div
        className={`relative mx-4 h-[270px] overflow-hidden rounded-3xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] sm:mx-6 ${hasCover ? "bg-cover bg-center" : "bg-gradient-to-br from-primary to-foreground"}`}
        style={hasCover ? { backgroundImage: `url(${restaurant.cover_url})` } : undefined}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        {availability && <AvailabilityBadge availability={availability} timezone={restaurant.timezone ?? "Africa/Abidjan"} className="absolute right-4 top-4 shadow-sm" />}
        <div className="relative flex h-full max-w-2xl flex-col justify-end p-5">
          <button
            onClick={scrollToMenu}
            className="inline-flex h-11 w-fit items-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground shadow-lg transition-opacity hover:opacity-90"
          >
            Commander maintenant
          </button>
        </div>
      </div>

      {(location || restaurant.phone) && (
        <div className="mx-4 mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-xs text-muted-foreground sm:mx-6">
          {location && (
            <span className="flex min-w-0 items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" /> {location}
            </span>
          )}
          {restaurant.phone && (
            <a href={`tel:${restaurant.phone}`} className="flex items-center gap-1.5 hover:text-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0 text-primary" /> {restaurant.phone}
            </a>
          )}
        </div>
      )}
    </section>
  );
}

import type { PublicRestaurant, PublicRestaurantSettings } from "@/lib/menu-db";
import type { RestaurantAvailability } from "@/lib/businessHours";
import { AvailabilityBadge } from "@/components/tenant/AvailabilityBadge";

function scrollToMenu() {
  document.getElementById("carte")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function TenantHero({
  restaurant,
  settings,
  availability,
}: {
  restaurant: PublicRestaurant;
  settings: PublicRestaurantSettings | null;
  availability: RestaurantAvailability | null;
}) {
  const hasCover = Boolean(restaurant.cover_url);
  // The single hero banner also carries the real fulfillment fact that used
  // to live in a separate red promo card below it -- merging the two avoids
  // showing two "delivery available" blocks back to back. Never fabricated:
  // renders only when the restaurant actually has one of these enabled.
  const fulfillmentLine = settings?.delivery_enabled
    ? "Livraison disponible"
    : settings?.pickup_enabled
      ? "Retrait sur place disponible"
      : null;

  return (
    <section id="accueil" className="bg-background pt-1">
      <div
        className={`relative mx-4 h-[220px] overflow-hidden rounded-3xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] sm:mx-6 sm:h-[280px] ${hasCover ? "bg-cover bg-center" : "bg-gradient-to-br from-primary to-foreground"}`}
        style={hasCover ? { backgroundImage: `url(${restaurant.cover_url})` } : undefined}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        {availability && <AvailabilityBadge availability={availability} timezone={restaurant.timezone ?? "Africa/Abidjan"} className="absolute right-4 top-4 shadow-sm" />}
        <div className="relative flex h-full max-w-2xl flex-col justify-end gap-2.5 p-5">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.25em] text-gold">{restaurant.name}</p>
          {fulfillmentLine && (
            <h1 className="font-display text-2xl font-extrabold leading-tight text-white sm:text-3xl">{fulfillmentLine}</h1>
          )}
          <button
            onClick={scrollToMenu}
            className="inline-flex h-11 w-fit items-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground shadow-lg transition-opacity hover:opacity-90"
          >
            Commander maintenant
          </button>
        </div>
      </div>
    </section>
  );
}

import { useEffect, useState } from "react";
import type { PublicRestaurant, PublicRestaurantSettings } from "@/lib/menu-db";
import type { RestaurantAvailability } from "@/lib/businessHours";
import { AvailabilityBadge } from "@/components/tenant/AvailabilityBadge";

function scrollToMenu() {
  document.getElementById("carte")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Small white plate for the logo, overlaid top-left on the cover -- keeps the
 * logo readable (object-contain, no crop/deform) against an arbitrary photo. */
function TenantHeroLogo({ restaurant, failed, onError }: { restaurant: PublicRestaurant; failed: boolean; onError: () => void }) {
  const showImage = Boolean(restaurant.logo_url) && !failed;
  return (
    <div className="absolute left-4 top-4 flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-2xl bg-white p-2 shadow-[0_4px_12px_rgba(0,0,0,0.18)] sm:h-[88px] sm:w-[88px] lg:h-24 lg:w-24">
      {showImage ? (
        <img
          src={restaurant.logo_url ?? undefined}
          alt={restaurant.name}
          className="h-full w-full object-contain"
          loading="eager"
          onError={onError}
        />
      ) : (
        <span className="font-display text-lg font-bold text-primary sm:text-xl lg:text-2xl">{restaurant.name.charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
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
  // Detected via a hidden preloader below (a CSS background-image never
  // fires onError), so a dead/invalid cover URL falls back to the plain
  // gradient instead of leaving a blank hole.
  const [coverFailed, setCoverFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => setCoverFailed(false), [restaurant.cover_url]);
  useEffect(() => setLogoFailed(false), [restaurant.logo_url]);

  const hasCover = Boolean(restaurant.cover_url) && !coverFailed;
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
        className={`relative mx-4 h-[210px] overflow-hidden rounded-3xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] sm:mx-6 sm:h-[280px] lg:h-[320px] ${hasCover ? "bg-cover bg-center" : "bg-gradient-to-br from-primary to-foreground"}`}
        style={hasCover ? { backgroundImage: `url(${restaurant.cover_url})` } : undefined}
      >
        {restaurant.cover_url && !coverFailed && (
          <img src={restaurant.cover_url} alt="" aria-hidden="true" className="hidden" onError={() => setCoverFailed(true)} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <TenantHeroLogo restaurant={restaurant} failed={logoFailed} onError={() => setLogoFailed(true)} />
        {availability && (
          <AvailabilityBadge
            availability={availability}
            timezone={restaurant.timezone ?? "Africa/Abidjan"}
            className="absolute right-4 top-4 max-w-[calc(100%-2rem)] shadow-sm"
          />
        )}
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

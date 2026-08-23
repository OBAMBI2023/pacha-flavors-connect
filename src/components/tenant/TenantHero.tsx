import { useEffect, useState } from "react";
import type { PublicRestaurant, PublicRestaurantSettings } from "@/lib/menu-db";
import type { RestaurantAvailability } from "@/lib/businessHours";
import { AvailabilityBadge } from "@/components/tenant/AvailabilityBadge";

function scrollToMenu() {
  document.getElementById("carte")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Small white plate for the logo -- object-contain so it's never cropped or
 * deformed. Sits in the identity row below the cover, not on the image. */
function TenantHeroLogo({ restaurant, failed, onError }: { restaurant: PublicRestaurant; failed: boolean; onError: () => void }) {
  const showImage = Boolean(restaurant.logo_url) && !failed;
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white p-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.1)] ring-1 ring-border sm:h-16 sm:w-16">
      {showImage ? (
        <img
          src={restaurant.logo_url ?? undefined}
          alt={restaurant.name}
          className="h-full w-full object-contain"
          loading="eager"
          onError={onError}
        />
      ) : (
        <span className="font-display text-lg font-bold text-primary">{restaurant.name.charAt(0).toUpperCase()}</span>
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
      {/* Cover: image only -- no text, logo, badge, or gradient on top of it. */}
      <div
        className={`mx-4 h-[210px] overflow-hidden rounded-3xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] sm:mx-6 sm:h-[280px] lg:h-[320px] ${hasCover ? "bg-cover bg-center" : "bg-gradient-to-br from-primary to-foreground"}`}
        style={hasCover ? { backgroundImage: `url(${restaurant.cover_url})` } : undefined}
      >
        {restaurant.cover_url && !coverFailed && (
          <img src={restaurant.cover_url} alt="" aria-hidden="true" className="hidden" onError={() => setCoverFailed(true)} />
        )}
      </div>

      {/* Identity block: name, logo, status, and the CTA now live in the
          normal page flow below the cover instead of overlaid on it. */}
      <div className="mx-4 mt-4 space-y-3 sm:mx-6">
        <div className="flex items-center gap-3">
          <TenantHeroLogo restaurant={restaurant} failed={logoFailed} onError={() => setLogoFailed(true)} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-xl font-semibold text-foreground sm:text-2xl">{restaurant.name}</p>
            {availability && (
              <AvailabilityBadge availability={availability} timezone={restaurant.timezone ?? "Africa/Abidjan"} className="mt-1" />
            )}
          </div>
        </div>
        {fulfillmentLine && <p className="text-sm font-medium text-muted-foreground">{fulfillmentLine}</p>}
        <button
          onClick={scrollToMenu}
          className="inline-flex h-11 w-fit items-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground shadow-lg transition-opacity hover:opacity-90"
        >
          Commander maintenant
        </button>
      </div>
    </section>
  );
}

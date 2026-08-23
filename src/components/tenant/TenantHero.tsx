import { useEffect, useState } from "react";
import type { PublicRestaurant } from "@/lib/menu-db";

export function TenantHero({ restaurant }: { restaurant: PublicRestaurant }) {
  // Detected via a hidden preloader below (a CSS background-image never
  // fires onError), so a dead/invalid cover URL falls back to the plain
  // gradient instead of leaving a blank hole.
  const [coverFailed, setCoverFailed] = useState(false);
  useEffect(() => setCoverFailed(false), [restaurant.cover_url]);

  const hasCover = Boolean(restaurant.cover_url) && !coverFailed;

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
    </section>
  );
}

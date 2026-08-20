import { ChevronDown, MapPin, Phone, ShoppingBag } from "lucide-react";
import type { PublicRestaurant, PublicRestaurantSettings } from "@/lib/menu-db";

function scrollToMenu() {
  document.getElementById("carte")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function TenantHero({
  restaurant,
  settings,
}: {
  restaurant: PublicRestaurant;
  settings: PublicRestaurantSettings | null;
}) {
  const location = [restaurant.address, restaurant.commune, restaurant.city].filter(Boolean).join(", ");
  const hasCover = Boolean(restaurant.cover_url);

  return (
    <section
      id="accueil"
      className={`relative flex min-h-[520px] items-end overflow-hidden md:min-h-[600px] ${
        hasCover ? "bg-cocoa bg-cover bg-center text-cocoa-foreground" : "bg-gradient-to-br from-cocoa to-cocoa/80 text-cocoa-foreground"
      }`}
      style={hasCover ? { backgroundImage: `url(${restaurant.cover_url})` } : undefined}
    >
      {hasCover && (
        <>
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/55 to-black/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        </>
      )}
      <div className="relative mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-gold">Bienvenue chez</p>
        <h1 className="mt-4 max-w-3xl text-balance-title font-display text-4xl font-semibold leading-[1.05] sm:text-5xl lg:text-6xl">
          {restaurant.name}
        </h1>
        {settings?.description && (
          <p className="mt-4 max-w-2xl font-display text-lg italic leading-relaxed text-gold/90 sm:text-xl">
            {settings.description}
          </p>
        )}
        {(location || restaurant.phone) && (
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-cocoa-foreground/80">
            {location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-gold" /> {location}
              </span>
            )}
            {restaurant.phone && (
              <a href={`tel:${restaurant.phone}`} className="flex items-center gap-1.5 hover:text-cocoa-foreground">
                <Phone className="h-4 w-4 text-gold" /> {restaurant.phone}
              </a>
            )}
          </div>
        )}
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            onClick={scrollToMenu}
            className="inline-flex items-center gap-2 rounded-full bg-gold px-7 py-3.5 text-sm font-semibold text-gold-foreground shadow-lg transition-opacity hover:opacity-90"
          >
            <ShoppingBag className="h-4 w-4" /> Commander maintenant
          </button>
          <button
            onClick={scrollToMenu}
            className="inline-flex items-center gap-2 rounded-full border border-cocoa-foreground/30 px-7 py-3.5 text-sm font-semibold transition-colors hover:bg-cocoa-foreground/10"
          >
            Voir le menu <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

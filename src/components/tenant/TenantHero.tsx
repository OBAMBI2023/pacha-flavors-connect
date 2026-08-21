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
          <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/70 to-black/30 sm:from-black/90 sm:via-black/55 sm:to-black/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent sm:via-black/10" />
        </>
      )}
      <div className="relative mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        {/* Dedicated backdrop on mobile guarantees text contrast regardless of the cover image; the wider gradients above take over from sm: up. */}
        <div
          className={`max-w-[92%] rounded-2xl p-4 sm:max-w-none sm:rounded-none sm:bg-transparent sm:p-0 ${
            hasCover ? "bg-black/45 backdrop-blur-[2px] sm:backdrop-blur-none" : ""
          }`}
        >
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-gold">Bienvenue chez</p>
          <h1 className="mt-4 max-w-full text-balance-title font-display text-3xl font-semibold leading-[1.1] sm:max-w-3xl sm:text-5xl lg:text-6xl">
            {restaurant.name}
          </h1>
          {settings?.description && (
            <p className="mt-4 max-w-full font-display text-base italic leading-relaxed text-gold/90 sm:max-w-2xl sm:text-xl">
              {settings.description}
            </p>
          )}
          {(location || restaurant.phone) && (
            <div className="mt-6 flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2 text-sm text-cocoa-foreground/80">
              {location && (
                <span className="flex min-w-0 items-center gap-1.5 break-words">
                  <MapPin className="h-4 w-4 shrink-0 text-gold" /> {location}
                </span>
              )}
              {restaurant.phone && (
                <a
                  href={`tel:${restaurant.phone}`}
                  className="flex min-w-0 items-center gap-1.5 whitespace-nowrap hover:text-cocoa-foreground"
                >
                  <Phone className="h-4 w-4 shrink-0 text-gold" /> {restaurant.phone}
                </a>
              )}
            </div>
          )}
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            onClick={scrollToMenu}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-gold px-7 py-3.5 text-sm font-semibold text-gold-foreground shadow-lg transition-opacity hover:opacity-90 sm:w-auto"
          >
            <ShoppingBag className="h-4 w-4 shrink-0" /> Commander maintenant
          </button>
          <button
            onClick={scrollToMenu}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-cocoa-foreground/30 px-7 py-3.5 text-sm font-semibold transition-colors hover:bg-cocoa-foreground/10 sm:w-auto"
          >
            Voir le menu <ChevronDown className="h-4 w-4 shrink-0" />
          </button>
        </div>
      </div>
    </section>
  );
}

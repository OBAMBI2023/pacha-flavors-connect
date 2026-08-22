import { MapPin, Phone } from "lucide-react";
import type { PublicRestaurant, PublicRestaurantSettings } from "@/lib/menu-db";

function scrollToMenu() {
  document.getElementById("carte")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function TenantHero({
  restaurant,
}: {
  restaurant: PublicRestaurant;
  settings: PublicRestaurantSettings | null;
}) {
  const location = [restaurant.address, restaurant.commune, restaurant.city].filter(Boolean).join(", ");
  const hasCover = Boolean(restaurant.cover_url);

  return (
    <section id="accueil" className="bg-[#F7F7F7] pt-1">
      <div
        className={`relative mx-4 h-[270px] overflow-hidden rounded-3xl sm:mx-6 ${hasCover ? "bg-cover bg-center" : "bg-gradient-to-br from-[#111111] to-[#2b2b2b]"}`}
        style={hasCover ? { backgroundImage: `url(${restaurant.cover_url})` } : undefined}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <div className="relative flex h-full max-w-2xl flex-col justify-end p-5">
          <button
            onClick={scrollToMenu}
            className="inline-flex h-11 w-fit items-center gap-2 rounded-full bg-[#F5A900] px-6 text-sm font-bold text-[#111111] shadow-lg transition-opacity hover:opacity-90"
          >
            Commander maintenant
          </button>
        </div>
      </div>

      {(location || restaurant.phone) && (
        <div className="mx-4 mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-xs text-[#666666] sm:mx-6">
          {location && (
            <span className="flex min-w-0 items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#F5A900]" /> {location}
            </span>
          )}
          {restaurant.phone && (
            <a href={`tel:${restaurant.phone}`} className="flex items-center gap-1.5 hover:text-[#171717]">
              <Phone className="h-3.5 w-3.5 shrink-0 text-[#F5A900]" /> {restaurant.phone}
            </a>
          )}
        </div>
      )}
    </section>
  );
}

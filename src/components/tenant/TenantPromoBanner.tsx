import type { PublicRestaurant, PublicRestaurantSettings } from "@/lib/menu-db";

function scrollToMenu() {
  document.getElementById("carte")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Real, non-fabricated promotional content: the restaurant's own fulfillment
 * options, never an invented discount percentage. Renders only when there is
 * something genuine to say.
 */
export function TenantPromoBanner({ restaurant, settings }: { restaurant: PublicRestaurant; settings: PublicRestaurantSettings | null }) {
  if (!settings?.delivery_enabled && !settings?.pickup_enabled) return null;

  const title = settings.delivery_enabled ? "Livraison disponible" : "Retrait sur place disponible";

  return (
    <section className="mx-4 my-4 overflow-hidden rounded-[18px] bg-[#111111] px-5 py-5 text-white sm:mx-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#F5A900]">SAOVIA</p>
      <h3 className="mt-1 font-display text-xl font-extrabold">{title}</h3>
      <p className="mt-1 text-sm text-white/70">Commandez en quelques secondes chez {restaurant.name}.</p>
      <button onClick={scrollToMenu} className="mt-3 inline-flex h-10 items-center rounded-full bg-[#F5A900] px-5 text-sm font-bold text-[#111111] transition-opacity hover:opacity-90">
        Commander maintenant
      </button>
    </section>
  );
}

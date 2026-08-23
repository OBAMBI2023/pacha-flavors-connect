import { Link, useLocation } from "@tanstack/react-router";
import { Home, Phone, ShoppingBag, Tag, UtensilsCrossed } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useUnreadOffersCount } from "@/lib/offers";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function TenantBottomNav({ restaurantSlug, onOpenOffers }: { restaurantSlug: string; onOpenOffers: () => void }) {
  const location = useLocation();
  const { count, openCart } = useCart();
  const unreadOffers = useUnreadOffersCount(restaurantSlug);
  const base = `/r/${restaurantSlug}`;
  const onHome = location.pathname === base;

  const itemClass = (isActive: boolean) =>
    `flex flex-1 flex-col items-center gap-1 py-2 text-[11px] ${isActive ? "font-bold text-primary" : "font-medium text-foreground"}`;
  const iconWrapClass = (isActive: boolean) =>
    `relative grid h-8 w-8 place-items-center rounded-full transition-colors ${isActive ? "bg-accent" : ""}`;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 rounded-t-[28px] border-t border-border bg-card px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.12)] md:hidden"
      style={{ height: "calc(76px + env(safe-area-inset-bottom))" }}
    >
      <div className="flex h-[76px] items-center">
        <Link to={base} className={itemClass(onHome)}>
          <span className={iconWrapClass(onHome)}><Home className="h-5 w-5" /></span>
          Accueil
        </Link>
        <button onClick={() => scrollToId("carte")} className={itemClass(false)}>
          <span className={iconWrapClass(false)}><UtensilsCrossed className="h-5 w-5" /></span>
          Menu
        </button>
        <button onClick={openCart} className={itemClass(false)}>
          <span className={iconWrapClass(false)}>
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.6rem] font-bold text-primary-foreground transition-transform">
                {count}
              </span>
            )}
          </span>
          Panier
        </button>
        <button onClick={onOpenOffers} className={itemClass(false)}>
          <span className={iconWrapClass(false)}>
            <Tag className="h-5 w-5" />
            {unreadOffers > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.6rem] font-bold text-primary-foreground">
                {unreadOffers > 9 ? "9+" : unreadOffers}
              </span>
            )}
          </span>
          Offres
        </button>
        <button onClick={() => scrollToId("localisation")} className={itemClass(false)}>
          <span className={iconWrapClass(false)}><Phone className="h-5 w-5" /></span>
          Contact
        </button>
      </div>
    </nav>
  );
}

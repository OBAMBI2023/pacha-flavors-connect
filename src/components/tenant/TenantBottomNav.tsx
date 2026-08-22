import { Link, useLocation } from "@tanstack/react-router";
import { Home, Phone, ShoppingBag, Tag, UtensilsCrossed } from "lucide-react";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function TenantBottomNav({ restaurantSlug }: { restaurantSlug: string }) {
  const location = useLocation();
  const base = `/r/${restaurantSlug}`;
  const onHome = location.pathname === base;

  const itemClass = (isActive: boolean) =>
    `flex flex-1 flex-col items-center gap-1 py-2 text-[11px] ${isActive ? "font-bold text-[#F5A900]" : "font-medium text-[#333333]"}`;
  const iconWrapClass = (isActive: boolean) =>
    `grid h-8 w-8 place-items-center rounded-full ${isActive ? "bg-[#FFF2C7]" : ""}`;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 rounded-t-[22px] border-t border-[#EAEAEA] bg-white px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-5px_20px_rgba(0,0,0,0.10)] md:hidden"
      style={{ height: "calc(70px + env(safe-area-inset-bottom))" }}
    >
      <div className="flex h-[70px] items-center">
        <Link to={base} className={itemClass(onHome)}>
          <span className={iconWrapClass(onHome)}><Home className="h-5 w-5" /></span>
          Accueil
        </Link>
        <button onClick={() => scrollToId("carte")} className={itemClass(false)}>
          <span className={iconWrapClass(false)}><UtensilsCrossed className="h-5 w-5" /></span>
          Menu
        </button>
        <Link to="/commandes" className={itemClass(location.pathname === "/commandes")}>
          <span className={iconWrapClass(location.pathname === "/commandes")}><ShoppingBag className="h-5 w-5" /></span>
          Commande
        </Link>
        <button onClick={() => scrollToId("populaires")} className={itemClass(false)}>
          <span className={iconWrapClass(false)}><Tag className="h-5 w-5" /></span>
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

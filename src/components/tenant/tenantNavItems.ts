import { useLocation } from "@tanstack/react-router";
import { Home, ShoppingBag, Tag, User, UtensilsCrossed } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useUnreadOffersCount } from "@/lib/offers";
import { useAccountAccess } from "@/lib/accountAccess";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export type TenantNavItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  to?: string;
  onClick?: () => void;
  badge?: string | undefined;
  active: boolean;
};

/**
 * Single source of truth for the tenant storefront's customer-facing navigation
 * (Accueil / Menu / Panier / Offres / Compte). TenantBottomNav (mobile) and
 * TenantHeader (desktop) both render this same item list so the two stay in
 * sync -- same entries, same order, same routes, same badges, same active state.
 */
export function useTenantNavItems({ restaurantSlug, onOpenOffers }: { restaurantSlug: string; onOpenOffers: () => void }) {
  const location = useLocation();
  const { count, openCart } = useCart();
  const unreadOffers = useUnreadOffersCount(restaurantSlug);
  const { modalOpen: accountModalOpen, openAccount, closeModal: closeAccountModal, submitPhone } = useAccountAccess(restaurantSlug);
  const base = `/r/${restaurantSlug}`;
  const onHome = location.pathname === base;

  const items: TenantNavItem[] = [
    { key: "accueil", label: "Accueil", icon: Home, to: base, active: onHome },
    { key: "menu", label: "Menu", icon: UtensilsCrossed, onClick: () => scrollToId("carte"), active: false },
    { key: "panier", label: "Panier", icon: ShoppingBag, onClick: openCart, badge: count > 0 ? String(count) : undefined, active: false },
    { key: "offres", label: "Offres", icon: Tag, onClick: onOpenOffers, badge: unreadOffers > 0 ? (unreadOffers > 9 ? "9+" : String(unreadOffers)) : undefined, active: false },
    { key: "compte", label: "Compte", icon: User, onClick: openAccount, active: false },
  ];

  return { items, accountModalOpen, closeAccountModal, submitPhone };
}

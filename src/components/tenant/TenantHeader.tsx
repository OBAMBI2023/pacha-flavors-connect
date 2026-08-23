import { useState } from "react";
import { Bell, ChevronDown, Menu, X } from "lucide-react";
import type { PublicRestaurant } from "@/lib/menu-db";
import { useDeliveryLocation } from "@/lib/deliveryLocation";
import { useUnreadClientNotificationsCount } from "@/lib/clientNotifications";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function TenantHeader({
  restaurant,
  hasContact,
  onOpenCart,
  onOpenNotifications,
}: {
  restaurant: PublicRestaurant;
  subtotalLabel: string;
  hasContact: boolean;
  onOpenCart: () => void;
  onOpenNotifications: () => void;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const { location, openModal: openLocationModal } = useDeliveryLocation();
  const unreadNotifications = useUnreadClientNotificationsCount(restaurant.slug);
  const shortLocation = location ? (location.commune ?? location.neighborhood ?? location.city ?? location.address) : null;
  // Both states stay tappable to the same modal -- only the copy changes, so
  // the control never uses the ambiguous "Modifier" and always says what
  // tapping it does next.
  const locationSecondaryLabel = location ? "Changer ma zone" : "Choisir une adresse";

  const navLinks = [
    { id: "accueil", label: "Accueil" },
    { id: "carte", label: "Notre carte" },
    ...(hasContact ? [{ id: "localisation", label: "Contact" }] : []),
  ];

  const logo = restaurant.logo_url ? (
    <img src={restaurant.logo_url} alt={restaurant.name} className="h-9 w-9 shrink-0 rounded-full object-contain lg:h-14 lg:w-14" />
  ) : (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground lg:h-14 lg:w-14 lg:text-2xl">
      {restaurant.name.charAt(0).toUpperCase()}
    </span>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card text-foreground">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:justify-between">
        {/* Mobile: hamburger | delivery location (opens the same location modal as the storefront bar) | profile+cart, each flex-1 so the layout balance is unchanged. */}
        <div className="flex flex-1 items-center lg:hidden">
          <button onClick={() => setNavOpen((v) => !v)} aria-label="Menu" className="grid h-10 w-10 place-items-center rounded-full border border-border">
            {navOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        <button
          type="button"
          onClick={() => openLocationModal()}
          className="flex min-h-11 flex-1 min-w-0 flex-col items-center justify-center gap-0 lg:hidden"
          aria-label="Adresse de livraison"
        >
          <span className="flex min-w-0 items-center gap-1 text-sm font-semibold text-foreground">
            <span aria-hidden="true">📍</span>
            <span className="truncate">{shortLocation ?? "Où livrer ?"}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </span>
          <span className="text-[0.7rem] font-medium text-primary">{locationSecondaryLabel}</span>
        </button>
        <div className="flex flex-1 items-center justify-end gap-2 lg:hidden">
          <button onClick={onOpenNotifications} aria-label="Notifications" className="relative grid h-10 w-10 place-items-center rounded-full border border-border text-foreground hover:bg-muted">
            <Bell className="h-5 w-5" />
            {unreadNotifications > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[0.65rem] font-bold text-primary-foreground">
                {unreadNotifications > 9 ? "9+" : unreadNotifications}
              </span>
            )}
          </button>
        </div>

        {/* Desktop layout, unchanged in spirit from before. */}
        <div className="hidden min-w-0 items-center gap-3 lg:flex">
          {logo}
          <span className="min-w-0 truncate font-display text-xl font-semibold tracking-wide">{restaurant.name}</span>
        </div>
        <nav className="hidden items-center gap-6 lg:flex">
          {navLinks.map((link) => (
            <button key={link.id} onClick={() => scrollToId(link.id)} className="text-sm font-medium text-foreground/80 transition-colors hover:text-primary">
              {link.label}
            </button>
          ))}
        </nav>
        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <button onClick={onOpenNotifications} aria-label="Notifications" className="relative grid h-11 w-11 place-items-center rounded-full border border-border hover:bg-muted">
            <Bell className="h-4 w-4" />
            {unreadNotifications > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[0.65rem] font-bold text-primary-foreground">
                {unreadNotifications > 9 ? "9+" : unreadNotifications}
              </span>
            )}
          </button>
          <button onClick={onOpenCart} className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90">
            Commander
          </button>
        </div>
      </div>

      {navOpen && (
        <nav className="border-t border-border bg-card px-4 py-3 lg:hidden">
          <ul className="flex flex-col">
            {navLinks.map((link) => (
              <li key={link.id}>
                <button
                  onClick={() => {
                    setNavOpen(false);
                    scrollToId(link.id);
                  }}
                  className="block w-full border-b border-border py-3 text-left text-sm font-medium last:border-b-0"
                >
                  {link.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}

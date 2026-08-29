import { useState } from "react";
import { Bell, ChevronDown, LayoutDashboard, Menu, Phone, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { PublicRestaurant } from "@/lib/menu-db";
import { useDeliveryLocation } from "@/lib/deliveryLocation";
import { useUnreadClientNotificationsCount } from "@/lib/clientNotifications";
import { useTenantNavItems } from "@/components/tenant/tenantNavItems";
import { AccountLookupModal } from "@/components/tenant/AccountLookupModal";
import { useAuth } from "@/hooks/useAuth";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function TenantHeader({
  restaurant,
  hasContact,
  onOpenOffers,
  onOpenNotifications,
}: {
  restaurant: PublicRestaurant;
  subtotalLabel: string;
  hasContact: boolean;
  onOpenOffers: () => void;
  onOpenNotifications: () => void;
}) {
  const [navOpen, setNavOpen] = useState(false);
  // Same session/membership/RBAC hook the Dashboard itself uses -- gated to
  // THIS storefront's own tenant (restaurant.id, resolved by the route, not
  // hardcoded), so an owner of a different restaurant browsing this one
  // never sees a Dashboard link into it. Super admin oversees every tenant,
  // so tenant-matching doesn't apply there.
  const { user, loading: authLoading, isSuperAdmin, isOwner, isManager, restaurantId } = useAuth();
  const isTenantAdmin = (isOwner || isManager) && restaurantId === restaurant.id;
  const showDashboardLink = !authLoading && Boolean(user) && (isSuperAdmin || isTenantAdmin);
  const dashboardHref = isSuperAdmin ? "/super-admin" : "/admin";
  const { location, openModal: openLocationModal } = useDeliveryLocation();
  const unreadNotifications = useUnreadClientNotificationsCount(restaurant.slug);
  const shortLocation = location ? (location.commune ?? location.neighborhood ?? location.city ?? location.address) : null;
  // Both states stay tappable to the same modal -- only the copy changes, so
  // the control never uses the ambiguous "Modifier" and always says what
  // tapping it does next.
  const locationSecondaryLabel = location ? "Changer ma zone" : "Choisir une adresse";

  // Mobile hamburger dropdown keeps its own, separate anchor-link list --
  // this is not the mobile bottom nav ("le menu téléphone actuel"), so it's
  // intentionally left untouched by the desktop nav unification below.
  const navLinks = [
    { id: "accueil", label: "Accueil" },
    { id: "carte", label: "Notre carte" },
    ...(hasContact ? [{ id: "localisation", label: "Contact" }] : []),
  ];

  // Desktop nav renders the exact same items as TenantBottomNav (the mobile
  // phone menu), from the same shared hook -- single source of truth.
  const { items, accountModalOpen, closeAccountModal, submitPhone } = useTenantNavItems({
    restaurantSlug: restaurant.slug,
    onOpenOffers,
  });

  // tel: hrefs must be digits/+ only -- the stored phone value may contain
  // spaces or separators meant for human display.
  const phoneHref = restaurant.phone ? `tel:${restaurant.phone.replace(/[^0-9+]/g, "")}` : null;

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
          {phoneHref && (
            <a href={phoneHref} aria-label={`Appeler ${restaurant.name}`} className="grid h-10 w-10 place-items-center rounded-full border border-border text-foreground hover:bg-muted">
              <Phone className="h-5 w-5" />
            </a>
          )}
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
          {phoneHref && (
            <a
              href={phoneHref}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
            >
              <Phone className="h-3.5 w-3.5 text-primary" />
              {restaurant.phone}
            </a>
          )}
        </div>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigation principale">
          {items.map((item) => {
            const Icon = item.icon;
            const className = `relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              item.active ? "bg-accent text-primary" : "text-foreground/80 hover:bg-muted hover:text-foreground"
            }`;
            const content = (
              <>
                <span className="relative grid place-items-center">
                  <Icon className="h-4 w-4" />
                  {item.badge !== undefined && (
                    <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.6rem] font-bold text-primary-foreground">
                      {item.badge}
                    </span>
                  )}
                </span>
                {item.label}
              </>
            );
            if (item.to) {
              return (
                <Link key={item.key} to={item.to} className={className}>
                  {content}
                </Link>
              );
            }
            return (
              <button key={item.key} type="button" onClick={item.onClick} className={className}>
                {content}
              </button>
            );
          })}
        </nav>
        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          {showDashboardLink && (
            <Link
              to={dashboardHref}
              className="inline-flex h-11 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-4 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
            >
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
              Mon Dashboard
            </Link>
          )}
          <button onClick={onOpenNotifications} aria-label="Notifications" className="relative grid h-11 w-11 place-items-center rounded-full border border-border hover:bg-muted">
            <Bell className="h-4 w-4" />
            {unreadNotifications > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[0.65rem] font-bold text-primary-foreground">
                {unreadNotifications > 9 ? "9+" : unreadNotifications}
              </span>
            )}
          </button>
        </div>
      </div>

      {navOpen && (
        <nav className="border-t border-border bg-card px-4 py-3 lg:hidden">
          <ul className="flex flex-col">
            {showDashboardLink && (
              <li>
                <Link
                  to={dashboardHref}
                  onClick={() => setNavOpen(false)}
                  className="flex min-h-11 items-center gap-2 border-b border-border py-3 text-left text-sm font-medium text-primary"
                >
                  <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                  Mon Dashboard
                </Link>
              </li>
            )}
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

      {accountModalOpen && (
        <AccountLookupModal restaurantName={restaurant.name} onClose={closeAccountModal} onSubmit={submitPhone} />
      )}
    </header>
  );
}

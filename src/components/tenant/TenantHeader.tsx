import { useState } from "react";
import { Menu, Phone, ShoppingBag, X } from "lucide-react";
import type { PublicRestaurant } from "@/lib/menu-db";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function TenantHeader({
  restaurant,
  cartCount,
  subtotalLabel,
  hasContact,
  onOpenCart,
}: {
  restaurant: PublicRestaurant;
  cartCount: number;
  subtotalLabel: string;
  hasContact: boolean;
  onOpenCart: () => void;
}) {
  const [navOpen, setNavOpen] = useState(false);

  const navLinks = [
    { id: "accueil", label: "Accueil" },
    { id: "carte", label: "Notre carte" },
    ...(hasContact ? [{ id: "localisation", label: "Contact" }] : []),
  ];

  return (
    <header className="border-b border-cocoa-foreground/10 bg-cocoa/95 text-cocoa-foreground backdrop-blur lg:border-border/60 lg:bg-background/90 lg:text-foreground">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => setNavOpen((v) => !v)}
            aria-label="Menu"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-cocoa-foreground/20 lg:hidden"
          >
            {navOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          {restaurant.logo_url ? (
            <img
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="h-12 w-12 shrink-0 rounded-full object-contain sm:h-14 sm:w-14 md:h-16 md:w-16 lg:h-[4.5rem] lg:w-[4.5rem]"
            />
          ) : (
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gold font-display text-lg font-semibold text-gold-foreground sm:h-14 sm:w-14 sm:text-xl md:h-16 md:w-16 md:text-2xl lg:h-[4.5rem] lg:w-[4.5rem]">
              {restaurant.name.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="min-w-0 truncate font-display text-lg font-semibold tracking-wide sm:text-xl">
            {restaurant.name}
          </span>
        </div>

        <nav className="hidden items-center gap-6 lg:flex">
          {navLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => scrollToId(link.id)}
              className="text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {restaurant.phone && (
            <a
              href={`tel:${restaurant.phone}`}
              aria-label="Appeler le restaurant"
              className="hidden h-11 w-11 place-items-center rounded-full border border-cocoa-foreground/20 transition-colors hover:bg-cocoa-foreground/10 sm:grid lg:border-border lg:hover:bg-accent"
            >
              <Phone className="h-4 w-4" />
            </a>
          )}
          <button
            onClick={onOpenCart}
            aria-label="Ouvrir le panier"
            className="relative flex h-11 items-center gap-2 rounded-full border border-cocoa-foreground/20 px-3 transition-colors hover:bg-cocoa-foreground/10 lg:border-border lg:hover:bg-accent"
          >
            <span className="relative">
              <ShoppingBag className="h-4 w-4" />
              {cartCount > 0 && (
                <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[0.65rem] font-semibold text-primary-foreground">
                  {cartCount}
                </span>
              )}
            </span>
            {cartCount > 0 && (
              <span className="hidden text-sm font-semibold sm:inline">{subtotalLabel}</span>
            )}
          </button>
          <button
            onClick={onOpenCart}
            className="hidden rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-gold-foreground shadow-sm transition-opacity hover:opacity-90 sm:inline-flex lg:bg-primary lg:text-primary-foreground"
          >
            Commander
          </button>
        </div>
      </div>

      {navOpen && (
        <nav className="border-t border-cocoa-foreground/10 bg-cocoa px-4 py-3 lg:hidden">
          <ul className="flex flex-col">
            {navLinks.map((link) => (
              <li key={link.id}>
                <button
                  onClick={() => {
                    setNavOpen(false);
                    scrollToId(link.id);
                  }}
                  className="block w-full border-b border-cocoa-foreground/10 py-3 text-left text-sm font-medium last:border-b-0"
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

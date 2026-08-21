import { useState } from "react";
import { Menu, ShoppingBag, X } from "lucide-react";
import { useCart } from "@/lib/cart";

const NAV = [
  { href: "#accueil", label: "Accueil" },
  { href: "#carte", label: "Menu" },
  { href: "#menu-du-jour", label: "Menu du jour" },
  { href: "#livraison", label: "Livraison" },
  { href: "#a-propos", label: "À propos" },
  { href: "#contact", label: "Contact" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const { count, openCart } = useCart();

  return (
    <header className="sticky top-0 z-40 bg-cocoa text-cocoa-foreground lg:border-b lg:border-border/60 lg:bg-background/90 lg:text-foreground lg:backdrop-blur">
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-2.5 sm:px-6 lg:flex lg:justify-between lg:py-4">
        <a href="#accueil" className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cocoa font-display text-lg font-semibold text-gold ring-2 ring-gold/70">
            P
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-display text-xl font-semibold tracking-wide text-cocoa-foreground lg:text-foreground">
              LE PACHA
            </span>
            <span className="block truncate text-[0.65rem] uppercase tracking-[0.2em] text-gold lg:text-muted-foreground">
              Restaurant
            </span>
          </span>
        </a>

        <nav className="hidden items-center gap-6 lg:flex">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
            >
              {n.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <a
            href="#reservation"
            className="hidden rounded-full border border-cocoa/30 px-4 py-2 text-sm font-medium transition-colors hover:bg-accent md:inline-flex"
          >
            Réserver
          </a>
          <button
            onClick={openCart}
            aria-label="Ouvrir le panier"
            className="relative grid h-10 w-10 place-items-center rounded-full border border-cocoa-foreground/20 transition-colors hover:bg-cocoa-foreground/10 lg:border-border lg:hover:bg-accent"
          >
            <ShoppingBag className="h-4 w-4" />
            {count > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[0.65rem] font-semibold text-primary-foreground">
                {count}
              </span>
            )}
          </button>
          <button
            onClick={openCart}
            className="hidden rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 sm:inline-flex"
          >
            Commander
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            className="grid h-10 w-10 place-items-center rounded-full border border-cocoa-foreground/20 hover:bg-cocoa-foreground/10 lg:border-border lg:hover:bg-accent lg:hidden"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-cocoa-foreground/15 bg-cocoa px-4 py-3 lg:hidden">
          <ul className="flex flex-col">
            {NAV.map((n) => (
              <li key={n.href}>
                <a
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="block border-b border-cocoa-foreground/10 py-3 text-sm font-medium"
                >
                  {n.label}
                </a>
              </li>
            ))}
            <li>
              <a
                href="#reservation"
                onClick={() => setOpen(false)}
                className="block py-3 text-sm font-semibold text-gold"
              >
                Réserver une table
              </a>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
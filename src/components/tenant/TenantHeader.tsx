import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, ShoppingCart, User, X } from "lucide-react";
import type { PublicRestaurant } from "@/lib/menu-db";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function TenantHeader({
  restaurant,
  cartCount,
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

  const logo = restaurant.logo_url ? (
    <img src={restaurant.logo_url} alt={restaurant.name} className="h-9 w-9 shrink-0 rounded-full object-contain lg:h-14 lg:w-14" />
  ) : (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#F5A900] font-display text-sm font-bold text-[#111111] lg:h-14 lg:w-14 lg:text-2xl">
      {restaurant.name.charAt(0).toUpperCase()}
    </span>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-[#EAEAEA] bg-white text-[#171717]">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:justify-between">
        {/* Mobile: hamburger | centered logo+name | profile+cart, each flex-1 so the center group stays visually centered. */}
        <div className="flex flex-1 items-center lg:hidden">
          <button onClick={() => setNavOpen((v) => !v)} aria-label="Menu" className="grid h-10 w-10 place-items-center rounded-full border border-[#EAEAEA]">
            {navOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        <div className="flex flex-1 min-w-0 items-center justify-center gap-2 lg:hidden">
          {logo}
          <span className="min-w-0 truncate font-display text-base font-bold">{restaurant.name}</span>
        </div>
        <div className="flex flex-1 items-center justify-end gap-2 lg:hidden">
          <Link to="/commandes" aria-label="Mes commandes" className="grid h-10 w-10 place-items-center rounded-full border border-[#EAEAEA] text-[#171717] hover:bg-[#F7F7F7]">
            <User className="h-5 w-5" />
          </Link>
          <button onClick={onOpenCart} aria-label="Ouvrir le panier" className="relative grid h-10 w-10 place-items-center rounded-full border border-[#EAEAEA] text-[#171717] hover:bg-[#F7F7F7]">
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#F5A900] px-1 text-[0.65rem] font-bold text-[#111111]">
                {cartCount}
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
            <button key={link.id} onClick={() => scrollToId(link.id)} className="text-sm font-medium text-[#171717]/80 transition-colors hover:text-[#F5A900]">
              {link.label}
            </button>
          ))}
        </nav>
        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <Link to="/commandes" aria-label="Mes commandes" className="grid h-11 w-11 place-items-center rounded-full border border-[#EAEAEA] hover:bg-[#F7F7F7]">
            <User className="h-4 w-4" />
          </Link>
          <button onClick={onOpenCart} aria-label="Ouvrir le panier" className="relative grid h-11 w-11 place-items-center rounded-full border border-[#EAEAEA] hover:bg-[#F7F7F7]">
            <ShoppingCart className="h-4 w-4" />
            {cartCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#F5A900] px-1 text-[0.65rem] font-bold text-[#111111]">
                {cartCount}
              </span>
            )}
          </button>
          <button onClick={onOpenCart} className="rounded-full bg-[#F5A900] px-5 py-2.5 text-sm font-bold text-[#111111] shadow-sm transition-opacity hover:opacity-90">
            Commander
          </button>
        </div>
      </div>

      {navOpen && (
        <nav className="border-t border-[#EAEAEA] bg-white px-4 py-3 lg:hidden">
          <ul className="flex flex-col">
            {navLinks.map((link) => (
              <li key={link.id}>
                <button
                  onClick={() => {
                    setNavOpen(false);
                    scrollToId(link.id);
                  }}
                  className="block w-full border-b border-[#EAEAEA] py-3 text-left text-sm font-medium last:border-b-0"
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

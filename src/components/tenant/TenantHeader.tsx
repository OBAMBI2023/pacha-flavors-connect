import { useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, ShoppingCart, User, X } from "lucide-react";
import type { PublicRestaurant } from "@/lib/menu-db";

const CUSTOMER_PHONE_KEY = "saovia.customer.phone";
const CUSTOMER_RESTAURANT_SLUG_KEY = "saovia.restaurant.slug";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function AccountLookupModal({ restaurantName, onClose, onSubmit }: { restaurantName: string; onClose: () => void; onSubmit: (phone: string) => void }) {
  const [phone, setPhone] = useState("");

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-[#171717]">Mes commandes</h2>
            <p className="mt-1 text-sm text-[#171717]/70">
              Entrez le numero utilise lors de votre commande chez {restaurantName} pour la retrouver.
            </p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-[#F7F7F7]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (phone.trim()) onSubmit(phone.trim());
          }}
        >
          <input
            type="tel"
            autoFocus
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Numero de telephone"
            className="w-full rounded-xl border border-[#EAEAEA] px-4 py-3 text-sm outline-none focus:border-[#F5A900]"
          />
          <button
            type="submit"
            disabled={!phone.trim()}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#F5A900] px-6 text-sm font-bold text-[#111111] shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Voir mes commandes
          </button>
        </form>
        <p className="mt-4 text-xs text-[#171717]/60">
          Pas encore commande ? Fermez cette fenetre et ajoutez un plat au panier pour passer votre premiere commande.
        </p>
      </div>
    </div>,
    document.body,
  );
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
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);

  function handleAccountClick(e: React.MouseEvent) {
    e.preventDefault();
    const storedPhone = window.localStorage.getItem(CUSTOMER_PHONE_KEY);
    const storedSlug = window.localStorage.getItem(CUSTOMER_RESTAURANT_SLUG_KEY);
    if (storedPhone && storedSlug === restaurant.slug) {
      navigate({ to: "/commandes" });
    } else {
      setAccountModalOpen(true);
    }
  }

  function handlePhoneSubmit(phone: string) {
    window.localStorage.setItem(CUSTOMER_PHONE_KEY, phone);
    window.localStorage.setItem(CUSTOMER_RESTAURANT_SLUG_KEY, restaurant.slug);
    setAccountModalOpen(false);
    navigate({ to: "/commandes" });
  }

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
          <Link to="/commandes" onClick={handleAccountClick} aria-label="Mes commandes" className="grid h-10 w-10 place-items-center rounded-full border border-[#EAEAEA] text-[#171717] hover:bg-[#F7F7F7]">
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
          <Link to="/commandes" onClick={handleAccountClick} aria-label="Mes commandes" className="grid h-11 w-11 place-items-center rounded-full border border-[#EAEAEA] hover:bg-[#F7F7F7]">
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

      {accountModalOpen && (
        <AccountLookupModal
          restaurantName={restaurant.name}
          onClose={() => setAccountModalOpen(false)}
          onSubmit={handlePhoneSubmit}
        />
      )}
    </header>
  );
}

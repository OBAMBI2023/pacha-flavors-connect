import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoMark from "@/assets/saovia-food-logo.png";

/** Shared across every /food* page (the main landing page and /food/conseils
 * so far) so header markup/behavior never drifts between pages -- edit here
 * once, both pages pick it up. */
const NAV_LINKS = [
  { label: "Accueil", to: "/food" as const },
  { label: "Fonctionnalités", href: "/food#fonctionnalites" },
  { label: "Tarifs", href: "/food#tarifs" },
  { label: "Témoignages", href: "/food#temoignages" },
  { label: "Conseils", to: "/food/conseils" as const },
  { label: "FAQ", href: "/food#faq" },
];

type FoodHeaderProps = {
  /** Path of the current page, used only to highlight the matching nav
   * link (orange text + a discreet underline), e.g. "/food/conseils". */
  activePath?: string;
};

export function FoodHeader({ activePath }: FoodHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/food" className="flex items-center gap-2">
          <img src={logoMark} alt="" className="h-8 w-8 rounded-full object-cover" />
          <span className="font-display text-lg font-bold tracking-tight text-foreground">
            SAOVIA
            <span className="ml-1.5 align-middle text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-primary">
              Food
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
          {NAV_LINKS.map((link) => {
            const isActive = !!activePath && link.to === activePath;
            const linkClassName = isActive
              ? "relative text-primary after:absolute after:-bottom-1 after:left-0 after:h-[2px] after:w-full after:rounded-full after:bg-primary"
              : "hover:text-foreground";
            return link.to ? (
              <Link key={link.label} to={link.to} className={linkClassName}>
                {link.label}
              </Link>
            ) : (
              <a key={link.label} href={link.href} className={linkClassName}>
                {link.label}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/auth"
            className="hidden items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-accent sm:inline-flex"
          >
            Se connecter
          </Link>
          <Button asChild size="sm" className="hidden h-10 rounded-full px-4 sm:h-9 md:inline-flex">
            <Link to="/food-signup">
              Créer mon restaurant <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </Button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={mobileMenuOpen}
            className="grid h-9 w-9 place-items-center rounded-full border border-border text-foreground md:hidden"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Real mobile menu -- collapsible, not just a shrunk desktop nav. */}
      {mobileMenuOpen && (
        <div className="border-t border-border bg-background px-4 py-4 sm:px-6 md:hidden">
          <nav className="flex flex-col gap-1 text-sm font-medium text-foreground">
            {NAV_LINKS.map((link) => {
              const isActive = !!activePath && link.to === activePath;
              const linkClassName = `rounded-lg px-2 py-2.5 hover:bg-accent ${
                isActive ? "text-primary" : ""
              }`;
              return link.to ? (
                <Link
                  key={link.label}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={linkClassName}
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={linkClassName}
                >
                  {link.label}
                </a>
              );
            })}
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
            <Link
              to="/auth"
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex h-11 items-center justify-center rounded-full border border-border text-sm font-semibold hover:bg-accent"
            >
              Se connecter
            </Link>
            <Button asChild className="h-11 rounded-full">
              <Link to="/food-signup" onClick={() => setMobileMenuOpen(false)}>
                Créer mon restaurant <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}

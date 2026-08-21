import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, ShoppingBag, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ITEMS: Array<{ label: string; icon: LucideIcon; to?: string }> = [
  { label: "Accueil", icon: Home, to: "/restaurants" },
  { label: "Explorer", icon: Search, to: "/rechercher" },
  { label: "Commandes", icon: ShoppingBag },
  { label: "Compte", icon: User },
];

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-4 pb-[env(safe-area-inset-bottom)]">
        {ITEMS.map(({ label, icon: Icon, to }) => {
          const active = to ? pathname === to : false;
          const className = `flex flex-col items-center gap-1 py-3 text-xs font-medium ${
            active ? "text-primary" : "text-muted-foreground"
          }`;
          if (!to) {
            return (
              <span key={label} className={`${className} opacity-50`} aria-disabled title="Bientôt disponible">
                <Icon className="h-6 w-6" />
                {label}
              </span>
            );
          }
          return (
            <Link key={label} to={to as never} className={className}>
              <Icon className="h-6 w-6" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

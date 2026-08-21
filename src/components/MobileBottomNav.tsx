import { useEffect, useRef, useState } from "react";
import { Home, LayoutGrid, Search, ShoppingBag, MoreHorizontal } from "lucide-react";
import { useCart } from "@/lib/cart";

type Section = "accueil" | "carte";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function MobileBottomNav({
  onOpenSearch,
  onOpenMore,
  isSearchOpen,
  isMoreOpen,
}: {
  onOpenSearch: () => void;
  onOpenMore: () => void;
  isSearchOpen: boolean;
  isMoreOpen: boolean;
}) {
  const { count, isOpen, openCart } = useCart();
  const [activeSection, setActiveSection] = useState<Section>("accueil");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const targets = [
      { id: "accueil", section: "accueil" as Section },
      { id: "carte", section: "carte" as Section },
    ]
      .map(({ id, section }) => ({ el: document.getElementById(id), section }))
      .filter((t): t is { el: HTMLElement; section: Section } => Boolean(t.el));

    if (targets.length === 0) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const match = targets.find((t) => t.el === visible.target);
        if (match) setActiveSection(match.section);
      },
      { rootMargin: "-96px 0px -60% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    targets.forEach((t) => observerRef.current?.observe(t.el));
    return () => observerRef.current?.disconnect();
  }, []);

  const activeTab: "accueil" | "carte" | "recherche" | "panier" | "plus" = isMoreOpen
    ? "plus"
    : isSearchOpen
      ? "recherche"
      : isOpen
        ? "panier"
        : activeSection;

  const items = [
    {
      key: "accueil" as const,
      label: "Accueil",
      icon: Home,
      onClick: () => scrollToId("accueil"),
    },
    {
      key: "carte" as const,
      label: "Menu",
      icon: LayoutGrid,
      onClick: () => scrollToId("carte"),
    },
    {
      key: "recherche" as const,
      label: "Recherche",
      icon: Search,
      onClick: onOpenSearch,
    },
    {
      key: "panier" as const,
      label: "Panier",
      icon: ShoppingBag,
      onClick: openCart,
      badge: count > 0 ? count : undefined,
    },
    {
      key: "plus" as const,
      label: "Plus",
      icon: MoreHorizontal,
      onClick: onOpenMore,
    },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 rounded-t-[20px] border-t border-border bg-card shadow-[0_-4px_20px_rgba(0,0,0,0.08)] lg:hidden"
      aria-label="Navigation principale"
    >
      <div className="grid grid-cols-5 px-1 pb-[env(safe-area-inset-bottom)] pt-1.5">
        {items.map(({ key, label, icon: Icon, onClick, badge }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={onClick}
              aria-current={active ? "page" : undefined}
              className="flex min-h-11 flex-col items-center justify-center gap-0.5 py-1.5"
            >
              <span
                className={`relative grid h-9 w-11 place-items-center rounded-full transition-colors ${
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                {badge !== undefined && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.6rem] font-semibold text-primary-foreground">
                    {badge}
                  </span>
                )}
              </span>
              <span
                className={`text-[0.65rem] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

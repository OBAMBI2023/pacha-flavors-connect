import { useState } from "react";
import { LayoutGrid } from "lucide-react";
import { useMenuData } from "@/lib/menu-db";
import { MenuCard } from "./MenuCard";
import { TenantProductModal } from "./tenant/TenantProductModal";
import { useCart } from "@/lib/cart";
import type { MenuItem } from "@/data/menu";

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function MenuCategories({
  slug,
  activeCategory,
  onActiveCategoryChange,
  onOpenCategories,
}: {
  slug: string;
  activeCategory?: string;
  onActiveCategoryChange?: (id: string) => void;
  onOpenCategories?: () => void;
}) {
  const [internalActive, setInternalActive] = useState<string>("tous");
  const active = activeCategory ?? internalActive;
  const setActive = onActiveCategoryChange ?? setInternalActive;
  const { data, isLoading } = useMenuData(slug);
  const { add } = useCart();
  const [openItem, setOpenItem] = useState<MenuItem | null>(null);
  const all = data?.items ?? [];
  const tabs = [
    { id: "tous", label: "Tous" },
    ...(data?.categories ?? []).map((c) => ({ id: slugify(c.label), label: c.label })),
  ];
  const items = active === "tous" ? all : all.filter((i) => i.category === active);

  return (
    <section id="carte" className="section-pad bg-secondary/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">
            La carte
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">Notre carte</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Sélectionnez vos plats, ajoutez-les au panier et transmettez votre commande au
            restaurant en quelques secondes.
          </p>
        </div>

        <div className="relative mt-8">
          <div className="-mx-4 overflow-x-auto px-4 pb-2 pr-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max gap-2">
              {tabs.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActive(c.id)}
                  className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    active === c.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:bg-accent"
                  }`}
                >
                  {c.label}
                </button>
              ))}
              {onOpenCategories && (
                <button
                  onClick={onOpenCategories}
                  className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
                >
                  <LayoutGrid className="h-3.5 w-3.5" /> Toutes
                </button>
              )}
            </div>
          </div>
          {/* Fade hint on the right edge signaling more categories to scroll to */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-secondary/40 to-transparent"
          />
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
          {isLoading && (
            <p className="col-span-full text-sm text-muted-foreground">Chargement de la carte…</p>
          )}
          {items.map((item) => (
            <MenuCard key={item.id} item={item} onOpen={setOpenItem} />
          ))}
        </div>
      </div>

      <TenantProductModal
        item={openItem}
        onClose={() => setOpenItem(null)}
        onAdd={(item, qty) => {
          for (let i = 0; i < qty; i += 1) add(item);
        }}
      />
    </section>
  );
}

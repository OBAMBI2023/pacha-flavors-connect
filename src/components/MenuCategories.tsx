import { useState } from "react";
import { useMenuData } from "@/lib/menu-db";
import { MenuCard } from "./MenuCard";

export function MenuCategories() {
  const [active, setActive] = useState<string>("tous");
  const { data, isLoading } = useMenuData();
  const all = data?.items ?? [];
  const tabs = [
    { id: "tous", label: "Tous" },
    ...(data?.categories ?? []).map((c) => ({ id: c.slug, label: c.label })),
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

        <div className="-mx-4 mt-8 overflow-x-auto px-4 pb-2">
          <div className="flex w-max gap-2">
            {tabs.map((c) => (
              <button
                key={c.id}
                onClick={() => setActive(c.id)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  active === c.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-accent"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading && (
            <p className="text-sm text-muted-foreground">Chargement de la carte…</p>
          )}
          {items.map((item) => (
            <MenuCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
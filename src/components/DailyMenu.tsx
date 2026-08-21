import { useState } from "react";
import { useMenuData } from "@/lib/menu-db";
import { MenuCard } from "./MenuCard";
import { TenantProductModal } from "./tenant/TenantProductModal";
import { useCart } from "@/lib/cart";
import type { MenuItem } from "@/data/menu";

export function DailyMenu({ slug }: { slug: string }) {
  const { data } = useMenuData(slug);
  const { add } = useCart();
  const [openItem, setOpenItem] = useState<MenuItem | null>(null);
  const daily = (data?.items ?? []).filter((item) => item.daily);

  if (daily.length === 0) return null;

  return (
    <section id="menu-du-jour" className="section-pad bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">
          Aujourd'hui au Pacha
        </p>
        <h2 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">Menu du jour</h2>
        <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
          {daily.map((item) => (
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
import {
  Beef,
  CupSoda,
  Drumstick,
  Fish,
  Flame,
  IceCreamBowl,
  LayoutGrid,
  Pizza,
  Salad,
  Sandwich,
  Soup,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

export type CategoryTab = { id: string; label: string };

/** Purely decorative: picks a representative icon from the category's own label, so it works for any tenant's real categories without hardcoding a restaurant-specific list. */
function iconForCategory(label: string): LucideIcon {
  const l = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  if (l.includes("poulet") || l.includes("chicken")) return Drumstick;
  if (l.includes("poisson") || l.includes("fish") || l.includes("fruits de mer")) return Fish;
  if (l.includes("boisson") || l.includes("jus") || l.includes("drink") || l.includes("soda")) return CupSoda;
  if (l.includes("dessert") || l.includes("sucr")) return IceCreamBowl;
  if (l.includes("grill") || l.includes("braise") || l.includes("brochette")) return Flame;
  if (l.includes("soupe") || l.includes("sauce")) return Soup;
  if (l.includes("pizza")) return Pizza;
  if (l.includes("burger") || l.includes("sandwich")) return Sandwich;
  if (l.includes("salade") || l.includes("legume") || l.includes("accompagnement")) return Salad;
  if (l.includes("viande") || l.includes("boeuf")) return Beef;
  return UtensilsCrossed;
}

export function TenantCategoryNav({
  tabs,
  active,
  onSelect,
  onOpenCategories,
}: {
  tabs: CategoryTab[];
  active: string;
  onSelect: (id: string) => void;
  onOpenCategories?: () => void;
}) {
  return (
    <div className="bg-[#F7F7F7] pt-3.5">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max gap-3">
            {tabs.map((tab) => {
              const isActive = active === tab.id;
              const Icon = tab.id === "tous" ? LayoutGrid : iconForCategory(tab.label);
              return (
                <button
                  key={tab.id}
                  onClick={() => onSelect(tab.id)}
                  aria-current={isActive ? "true" : undefined}
                  className="flex w-16 shrink-0 flex-col items-center gap-1.5"
                >
                  <span
                    className={`grid h-[58px] w-[58px] place-items-center rounded-full shadow-sm transition-colors ${
                      isActive ? "border-2 border-[#F5A900] bg-[#FFF8E5]" : "border border-[#EEEEEE] bg-white"
                    }`}
                  >
                    <Icon className={`h-6 w-6 ${isActive ? "text-[#B17A00]" : "text-[#333333]"}`} />
                  </span>
                  <span className={`line-clamp-1 w-full text-center text-xs ${isActive ? "font-bold text-[#B17A00]" : "font-medium text-[#333333]"}`}>
                    {tab.label}
                  </span>
                </button>
              );
            })}
            {onOpenCategories && (
              <button onClick={onOpenCategories} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
                <span className="grid h-[58px] w-[58px] place-items-center rounded-full border border-[#EEEEEE] bg-white shadow-sm">
                  <LayoutGrid className="h-6 w-6 text-[#333333]" />
                </span>
                <span className="line-clamp-1 w-full text-center text-xs font-medium text-[#333333]">Toutes</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

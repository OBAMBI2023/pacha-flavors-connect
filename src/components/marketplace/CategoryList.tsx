import { Drumstick, Flame, GlassWater, IceCream, Salad, Soup, UtensilsCrossed, type LucideIcon } from "lucide-react";

const ICON_BY_KEYWORD: Array<[RegExp, LucideIcon]> = [
  [/poulet/i, Drumstick],
  [/brais|grill/i, Flame],
  [/boisson/i, GlassWater],
  [/accompagn|salade/i, Salad],
  [/dessert|glace/i, IceCream],
  [/plat/i, Soup],
];

function iconFor(label: string): LucideIcon {
  return ICON_BY_KEYWORD.find(([pattern]) => pattern.test(label))?.[1] ?? UtensilsCrossed;
}

export function CategoryList({
  categories,
  active,
  onSelect,
}: {
  categories: string[];
  active: string | null;
  onSelect: (category: string | null) => void;
}) {
  if (categories.length === 0) return null;

  return (
    <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:flex-wrap lg:justify-center lg:overflow-x-visible lg:px-0">
      {categories.map((category) => {
        const Icon = iconFor(category);
        const isActive = active === category;
        return (
          <button
            key={category}
            type="button"
            onClick={() => onSelect(isActive ? null : category)}
            className="flex shrink-0 flex-col items-center gap-2"
          >
            <span
              className={`flex h-[6.5rem] w-[6.5rem] items-center justify-center rounded-full border-2 transition-colors ${
                isActive ? "border-primary bg-primary/10" : "border-transparent bg-muted"
              }`}
            >
              <Icon className={`h-9 w-9 ${isActive ? "text-primary" : "text-foreground"}`} strokeWidth={1.5} />
            </span>
            <span className="text-sm font-semibold">{category}</span>
          </button>
        );
      })}
    </div>
  );
}

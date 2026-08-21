import { PersonStanding, Truck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type SortOption = "pertinence" | "nom-asc" | "nom-desc";

const SORT_LABELS: Record<SortOption, string> = {
  pertinence: "Pertinence",
  "nom-asc": "Nom (A-Z)",
  "nom-desc": "Nom (Z-A)",
};

function pillClass(active: boolean) {
  return `flex h-12 shrink-0 items-center gap-2 rounded-full border px-4 text-base font-semibold transition-colors ${
    active ? "border-primary bg-primary text-primary-foreground" : "border-transparent bg-muted text-foreground"
  }`;
}

function selectPillClass(active: boolean) {
  return `inline-flex h-12 w-auto shrink-0 items-center gap-2 rounded-full border px-4 text-base font-semibold transition-colors ${
    active ? "border-primary bg-primary text-primary-foreground" : "border-transparent bg-muted text-foreground"
  }`;
}

export function FilterBar({
  dishType,
  onDishTypeChange,
  dishTypes,
  pickupOnly,
  onPickupOnlyChange,
  sort,
  onSortChange,
  freeDeliveryOnly,
  onFreeDeliveryOnlyChange,
}: {
  dishType: string | null;
  onDishTypeChange: (value: string | null) => void;
  dishTypes: string[];
  pickupOnly: boolean;
  onPickupOnlyChange: (value: boolean) => void;
  sort: SortOption;
  onSortChange: (value: SortOption) => void;
  freeDeliveryOnly: boolean;
  onFreeDeliveryOnlyChange: (value: boolean) => void;
}) {
  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:flex-wrap lg:justify-center lg:overflow-x-visible lg:px-0">
      <Select value={dishType ?? "all"} onValueChange={(value) => onDishTypeChange(value === "all" ? null : value)}>
        <SelectTrigger className={selectPillClass(dishType !== null)}>
          <SelectValue placeholder="Type de plat">{dishType ?? "Type de plat"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les plats</SelectItem>
          {dishTypes.map((type) => (
            <SelectItem key={type} value={type}>
              {type}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <button type="button" onClick={() => onPickupOnlyChange(!pickupOnly)} className={pillClass(pickupOnly)}>
        <PersonStanding className="h-5 w-5" />
        Retrait
      </button>

      <Select value={sort} onValueChange={(value) => onSortChange(value as SortOption)}>
        <SelectTrigger className={selectPillClass(sort !== "pertinence")}>
          <SelectValue>{SORT_LABELS[sort]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
            <SelectItem key={option} value={option}>
              {SORT_LABELS[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <button
        type="button"
        onClick={() => onFreeDeliveryOnlyChange(!freeDeliveryOnly)}
        className={pillClass(freeDeliveryOnly)}
      >
        <Truck className="h-5 w-5" />
        Livraison gratuite
      </button>
    </div>
  );
}

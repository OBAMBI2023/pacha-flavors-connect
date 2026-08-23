import { Search, SlidersHorizontal } from "lucide-react";

export function TenantSearchBar({
  value,
  onChange,
  onOpenFilters,
}: {
  value: string;
  onChange: (value: string) => void;
  onOpenFilters: () => void;
}) {
  return (
    <div className="mx-4 my-2 flex items-center gap-2 sm:mx-6">
      <label className="flex h-[58px] flex-1 items-center gap-2 rounded-full bg-muted px-5">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Rechercher un plat..."
          className="w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>
      <button
        type="button"
        onClick={onOpenFilters}
        aria-label="Filtrer par catégorie"
        className="grid h-[58px] w-[58px] shrink-0 place-items-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-accent"
      >
        <SlidersHorizontal className="h-4 w-4" />
      </button>
    </div>
  );
}

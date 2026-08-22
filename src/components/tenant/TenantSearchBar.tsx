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
      <label className="flex h-12 flex-1 items-center gap-2 rounded-full bg-[#F5F5F5] px-4">
        <Search className="h-4 w-4 shrink-0 text-[#666666]" />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Rechercher un plat..."
          className="w-full bg-transparent text-sm text-[#171717] outline-none placeholder:text-[#666666]"
        />
      </label>
      <button
        type="button"
        onClick={onOpenFilters}
        aria-label="Filtrer par catégorie"
        className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#111111] text-white transition-opacity hover:opacity-90"
      >
        <SlidersHorizontal className="h-4 w-4" />
      </button>
    </div>
  );
}

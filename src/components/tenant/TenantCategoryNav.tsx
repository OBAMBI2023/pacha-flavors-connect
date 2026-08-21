import { LayoutGrid } from "lucide-react";

export type CategoryTab = { id: string; label: string };

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
    <div className="border-b border-border/60 bg-background/95 backdrop-blur">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="-mx-4 overflow-x-auto px-4 py-2.5 pr-8 [scrollbar-width:none] sm:mx-0 sm:px-0 sm:pr-8 [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onSelect(tab.id)}
                aria-current={active === tab.id ? "true" : undefined}
                className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  active === tab.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-accent"
                }`}
              >
                {tab.id === "tous" && <LayoutGrid className="h-3.5 w-3.5" />}
                {tab.label}
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
          className="pointer-events-none absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-background to-transparent sm:right-6"
        />
      </div>
    </div>
  );
}

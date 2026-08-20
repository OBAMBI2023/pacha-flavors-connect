import { LayoutGrid } from "lucide-react";

export type CategoryTab = { id: string; label: string };

export function TenantCategoryNav({
  tabs,
  active,
  onSelect,
}: {
  tabs: CategoryTab[];
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="border-b border-border/60 bg-background/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="-mx-4 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onSelect(tab.id)}
                aria-current={active === tab.id ? "true" : undefined}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  active === tab.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-accent"
                }`}
              >
                {tab.id === "tous" && <LayoutGrid className="h-3.5 w-3.5" />}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

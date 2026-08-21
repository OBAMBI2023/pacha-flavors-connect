import { UtensilsCrossed } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMenuData } from "@/lib/menu-db";

function slugify(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function CategoriesSheet({
  slug,
  open,
  onOpenChange,
  onSelectCategory,
}: {
  slug: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelectCategory: (categoryId: string) => void;
}) {
  const { data } = useMenuData(slug);
  const items = data?.items ?? [];
  const categories = (data?.categories ?? []).map((c) => {
    const id = slugify(c.label);
    const inCategory = items.filter((i) => i.category === id);
    return {
      id,
      label: c.label,
      count: inCategory.length,
      image: inCategory.find((i) => i.image)?.image,
    };
  });

  function select(id: string) {
    onOpenChange(false);
    onSelectCategory(id);
    requestAnimationFrame(() => {
      document.getElementById("carte")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex h-[80vh] flex-col rounded-t-[20px] pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle className="font-display text-xl">Catégories</SheetTitle>
        </SheetHeader>
        <div className="mt-4 flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => select("tous")}
              className="col-span-2 flex items-center justify-between rounded-2xl border border-primary bg-primary/10 px-4 py-3.5 text-left"
            >
              <span className="font-display text-lg font-semibold">Tous les plats</span>
              <span className="text-sm font-medium text-primary">{items.length} plats</span>
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => select(c.id)}
                className="overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
                  {c.image ? (
                    <img src={c.image} alt={c.label} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center">
                      <UtensilsCrossed className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-semibold">{c.label}</p>
                  <p className="text-xs text-muted-foreground">{c.count} plat{c.count > 1 ? "s" : ""}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

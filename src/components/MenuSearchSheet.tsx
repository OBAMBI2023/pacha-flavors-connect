import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMenuData } from "@/lib/menu-db";
import { formatPrice } from "@/data/menu";
import { useCart } from "@/lib/cart";

export function MenuSearchSheet({
  slug,
  open,
  onOpenChange,
}: {
  slug: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data } = useMenuData(slug);
  const { add, openCart } = useCart();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return (data?.items ?? []).filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.subtitle?.toLowerCase().includes(q),
    );
  }, [data?.items, query]);

  function goToCard() {
    onOpenChange(false);
    setQuery("");
    requestAnimationFrame(() => {
      document.getElementById("carte")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex h-[80vh] flex-col rounded-t-[20px] pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle className="font-display text-xl">Rechercher un plat</SheetTitle>
        </SheetHeader>
        <div className="mt-3 flex items-center gap-2 rounded-full border border-input bg-background px-4 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un plat…"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>

        <div className="mt-4 flex-1 overflow-y-auto">
          {query.trim() === "" && (
            <p className="text-sm text-muted-foreground">
              Commencez à taper pour rechercher dans la carte.
            </p>
          )}
          {query.trim() !== "" && results.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun plat ne correspond à « {query} ».</p>
          )}
          <ul className="space-y-2">
            {results.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-2"
              >
                <button
                  type="button"
                  onClick={goToCard}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  {item.image && (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-14 w-14 shrink-0 rounded-lg object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-primary">
                    {formatPrice(item.price)}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={!item.available}
                  onClick={() => {
                    add(item);
                    onOpenChange(false);
                    setQuery("");
                    openCart();
                  }}
                  aria-label="Ajouter au panier"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
                >
                  +
                </button>
              </li>
            ))}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}

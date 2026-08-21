import { ChevronRight, ShoppingBag } from "lucide-react";

export function TenantCartBar({
  count,
  subtotalLabel,
  onOpenCart,
}: {
  count: number;
  subtotalLabel: string;
  onOpenCart: () => void;
}) {
  if (count === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 lg:hidden">
      <button
        onClick={onOpenCart}
        className="flex w-full items-center gap-3 rounded-2xl bg-gold px-4 py-3 text-gold-foreground shadow-xl transition-opacity hover:opacity-95"
      >
        <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold-foreground/10">
          <ShoppingBag className="h-4 w-4" />
          <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-cocoa px-1 text-[0.65rem] font-semibold text-cocoa-foreground">
            {count}
          </span>
        </span>
        <span className="min-w-0 flex-1 text-left text-xs leading-tight text-gold-foreground/70">
          {count} article{count > 1 ? "s" : ""} dans le panier
          <br />
          <span className="text-sm font-bold text-gold-foreground">Total {subtotalLabel}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-cocoa px-4 py-2.5 text-xs font-semibold text-cocoa-foreground">
          Voir mon panier <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </button>
    </div>
  );
}

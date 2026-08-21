import { ShoppingBag, ChevronRight } from "lucide-react";
import { useCart } from "@/lib/cart";

export function StickyCartBar() {
  const { count, subtotal, hasUnpriced, isOpen, openCart } = useCart();

  if (count === 0 || isOpen) return null;

  const totalLabel = hasUnpriced
    ? subtotal > 0
      ? `${subtotal.toLocaleString("fr-FR")} FCFA + articles à confirmer`
      : "À confirmer"
    : `${subtotal.toLocaleString("fr-FR")} FCFA`;

  return (
    <button
      type="button"
      onClick={openCart}
      className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex items-center justify-between gap-2 rounded-2xl bg-gold px-4 py-3 text-gold-foreground shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition-transform active:scale-[0.98] lg:hidden"
    >
      <span className="flex shrink-0 items-center gap-2 text-sm font-semibold">
        <ShoppingBag className="h-4 w-4" />
        {count} article{count > 1 ? "s" : ""}
      </span>
      <span className="min-w-0 truncate text-sm font-semibold">{totalLabel}</span>
      <span className="flex shrink-0 items-center gap-0.5 text-sm font-semibold underline underline-offset-2">
        Voir le panier
        <ChevronRight className="h-4 w-4" />
      </span>
    </button>
  );
}

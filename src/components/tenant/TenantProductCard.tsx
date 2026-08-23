import { Minus, Plus } from "lucide-react";
import { useCart, computeLineKey } from "@/lib/cart";
import { formatPrepTime, getPromotionBadgeLabel, type MenuItem } from "@/data/menu";

export function TenantProductCard({ item, onOpen }: { item: MenuItem; onOpen: (item: MenuItem) => void }) {
  const { lines, add, increment, decrement } = useCart();

  function open() {
    if (item.available) onOpen(item);
  }

  const promotion = item.promotion;
  const hasPriceDiscount = promotion && promotion.type !== "free_delivery" && item.price !== null;

  // Products with option groups must go through the modal to choose them --
  // the card can only quick-add (skip straight to the cart) when there is
  // nothing to configure. `computeLineKey` with an empty array is exactly
  // the key that line would have, so it's a safe, single-source-of-truth
  // way to find an existing quantity for it.
  const prepTimeLabel = formatPrepTime(item.prepTimeMinutes);
  const hasOptions = (item.optionGroups ?? []).length > 0;
  const lineKey = computeLineKey(item.id, []);
  const qty = !hasOptions ? (lines.find((l) => l.key === lineKey)?.qty ?? 0) : 0;

  function handleQuickAdd(e: React.MouseEvent) {
    e.stopPropagation();
    if (!item.available) return;
    if (hasOptions) {
      onOpen(item);
      return;
    }
    add(item, 1);
  }

  function handleIncrement(e: React.MouseEvent) {
    e.stopPropagation();
    increment(lineKey);
  }

  function handleDecrement(e: React.MouseEvent) {
    e.stopPropagation();
    decrement(lineKey);
  }

  return (
    <article
      role="button"
      tabIndex={item.available ? 0 : -1}
      aria-disabled={!item.available}
      aria-label={item.available ? `Voir ${item.name}` : `${item.name} indisponible`}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      className={`group overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition-transform duration-300 ${
        item.available ? "cursor-pointer hover:-translate-y-1" : "cursor-not-allowed opacity-90"
      }`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {item.image ? (
          <img src={item.image} alt={item.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-stone-200 to-stone-300" />
        )}
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {item.featured && (
            <span className="rounded-full bg-gold px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-gold-foreground shadow-sm">
              Populaire
            </span>
          )}
          {promotion && (
            <span className="rounded-full bg-primary px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-primary-foreground shadow-sm">
              {getPromotionBadgeLabel(promotion)}
            </span>
          )}
        </div>
      </div>
      <div className="space-y-1.5 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="line-clamp-1 font-semibold">{item.name}</h3>
          {prepTimeLabel && <span className="shrink-0 text-[0.7rem] font-medium text-muted-foreground">{prepTimeLabel}</span>}
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
        <div className="flex items-center justify-between pt-1">
          {item.available ? (
            hasPriceDiscount ? (
              <span className="flex flex-col">
                <span className="text-base font-bold text-primary">{promotion!.final_price.toLocaleString("fr-FR")} FCFA</span>
                <span className="text-xs font-medium text-muted-foreground line-through">{item.price!.toLocaleString("fr-FR")} FCFA</span>
              </span>
            ) : (
              <span className="text-base font-bold text-primary">{item.price === null ? "À confirmer" : `${item.price.toLocaleString("fr-FR")} FCFA`}</span>
            )
          ) : (
            <span className="rounded-full bg-muted px-2 py-1 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">Indisponible</span>
          )}

          {item.available &&
            (qty > 0 ? (
              <div className="flex items-center gap-2.5 rounded-full border border-border bg-background px-1 py-1 transition-all">
                <button
                  type="button"
                  onClick={handleDecrement}
                  aria-label="Retirer un article"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-foreground transition-colors hover:bg-accent"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-3 text-center text-sm font-bold">{qty}</span>
                <button
                  type="button"
                  onClick={handleIncrement}
                  aria-label="Ajouter un article"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-colors hover:opacity-90"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleQuickAdd}
                aria-label={`Ajouter ${item.name} au panier`}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform hover:scale-105"
              >
                <Plus className="h-4 w-4" />
              </button>
            ))}
        </div>
      </div>
    </article>
  );
}

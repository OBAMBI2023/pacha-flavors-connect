import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getPromotionBadgeLabel, type MenuItem } from "@/data/menu";
import { QuantitySelector } from "@/components/tenant/QuantitySelector";

export function TenantProductModal({ item, onClose, onAdd }: { item: MenuItem | null; onClose: () => void; onAdd: (item: MenuItem, qty: number) => void }) {
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (item) setQty(1);
  }, [item]);

  if (!item) return null;

  const promotion = item.promotion;
  const hasPriceDiscount = Boolean(promotion) && promotion!.type !== "free_delivery" && item.price !== null;
  const unitPrice = hasPriceDiscount ? promotion!.final_price : (item.price ?? 0);
  const total = unitPrice * qty;

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-cocoa/50 px-3 py-3 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-[28px] bg-background shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Produit</p>
            <h2 className="mt-2 font-display text-2xl font-semibold">{item.name}</h2>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="grid h-10 w-10 place-items-center rounded-full hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto">
          <div className="relative aspect-[16/10] bg-muted">
            {item.image ? <img src={item.image} alt={item.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Aucune image</div>}
            {promotion && (
              <span className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-primary-foreground shadow-sm">
                {getPromotionBadgeLabel(promotion)}
              </span>
            )}
          </div>
          <div className="space-y-4 px-5 py-5">
            {item.subtitle ? <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">{item.subtitle}</p> : null}
            <p className="text-sm text-muted-foreground">{item.description}</p>
            {!item.available && (
              <span className="inline-block rounded-full bg-muted px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Indisponible pour le moment</span>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Prix unitaire</span>
              {hasPriceDiscount ? (
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground line-through">{item.price!.toLocaleString("fr-FR")} FCFA</span>
                  <span className="font-semibold text-primary">{unitPrice.toLocaleString("fr-FR")} FCFA</span>
                </span>
              ) : (
                <span className="font-semibold">{item.price === null ? "À confirmer" : `${unitPrice.toLocaleString("fr-FR")} FCFA`}</span>
              )}
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
              <span className="text-sm text-muted-foreground">Quantité</span>
              <QuantitySelector
                value={qty}
                onDecrement={() => setQty((current) => Math.max(1, current - 1))}
                onIncrement={() => setQty((current) => current + 1)}
                decrementDisabled={!item.available || qty <= 1}
                incrementDisabled={!item.available}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold">{total.toLocaleString("fr-FR")} FCFA</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-border px-5 py-4">
          <button onClick={onClose} className="h-12 rounded-2xl border border-border text-sm font-semibold">Fermer</button>
          <button
            onClick={() => {
              // Cart display only -- the server independently recomputes the
              // real charge from product_id via get_active_promotion, so
              // baking the discounted price into the cart item here can
              // never under/overcharge, it only keeps the cart preview
              // consistent with what create_order will actually total.
              onAdd(hasPriceDiscount ? { ...item, price: unitPrice } : item, qty);
              onClose();
            }}
            disabled={!item.available}
            className="h-12 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            {item.available ? "Ajouter au panier" : "Indisponible"}
          </button>
        </div>
      </div>
    </div>
  );
}

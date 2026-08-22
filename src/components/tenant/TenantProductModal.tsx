import { useEffect, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import type { MenuItem } from "@/data/menu";

export function TenantProductModal({ item, onClose, onAdd }: { item: MenuItem | null; onClose: () => void; onAdd: (item: MenuItem, qty: number) => void }) {
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (item) setQty(1);
  }, [item]);

  if (!item) return null;

  const unitPrice = item.price ?? 0;
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
          <div className="aspect-[16/10] bg-muted">
            {item.image ? <img src={item.image} alt={item.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Aucune image</div>}
          </div>
          <div className="space-y-4 px-5 py-5">
            {item.subtitle ? <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">{item.subtitle}</p> : null}
            <p className="text-sm text-muted-foreground">{item.description}</p>
            {!item.available && (
              <span className="inline-block rounded-full bg-muted px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Indisponible pour le moment</span>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Prix unitaire</span>
              <span className="font-semibold">{item.price === null ? "À confirmer" : `${unitPrice.toLocaleString("fr-FR")} FCFA`}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
              <span className="text-sm text-muted-foreground">Quantité</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setQty((current) => Math.max(1, current - 1))} disabled={!item.available} className="grid h-10 w-10 place-items-center rounded-full border border-border disabled:opacity-40"><Minus className="h-4 w-4" /></button>
                <span className="w-8 text-center font-semibold">{qty}</span>
                <button onClick={() => setQty((current) => current + 1)} disabled={!item.available} className="grid h-10 w-10 place-items-center rounded-full border border-border disabled:opacity-40"><Plus className="h-4 w-4" /></button>
              </div>
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
              onAdd(item, qty);
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

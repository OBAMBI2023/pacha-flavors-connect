import { useEffect, useState } from "react";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { formatPrepTime, getPromotionBadgeLabel, type MenuItem } from "@/data/menu";
import type { CartOptionSelection } from "@/lib/cart";
import { QuantitySelector } from "@/components/tenant/QuantitySelector";

export function TenantProductModal({
  item,
  onClose,
  onAdd,
}: {
  item: MenuItem | null;
  onClose: () => void;
  onAdd: (item: MenuItem, qty: number, options: CartOptionSelection[]) => void;
}) {
  const [qty, setQty] = useState(1);
  const [selected, setSelected] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (item) {
      setQty(1);
      setSelected({});
    }
  }, [item]);

  if (!item) return null;

  const optionGroups = item.optionGroups ?? [];
  const promotion = item.promotion;
  const hasPriceDiscount = Boolean(promotion) && promotion!.type !== "free_delivery" && item.price !== null;
  const unitPrice = hasPriceDiscount ? promotion!.final_price : (item.price ?? 0);

  const selectedFlat: CartOptionSelection[] = optionGroups.flatMap((group) =>
    (selected[group.id] ?? [])
      .map((optionId) => group.options.find((o) => o.id === optionId))
      .filter((o): o is NonNullable<typeof o> => Boolean(o))
      .map((o) => ({ id: o.id, name: o.name, extra_price: o.extra_price, group_name: group.name })),
  );
  const optionsExtra = selectedFlat.reduce((sum, o) => sum + o.extra_price, 0);
  const total = (unitPrice + optionsExtra) * qty;

  const allRequiredSatisfied = optionGroups.every((group) => {
    if (!group.is_required) return true;
    return (selected[group.id]?.length ?? 0) >= Math.max(group.min_select, 1);
  });
  const canAdd = item.available && allRequiredSatisfied;
  const prepTimeLabel = formatPrepTime(item.prepTimeMinutes);

  function toggleOption(groupId: string, optionId: string, selectionType: "single" | "multiple", maxSelect: number | null) {
    setSelected((current) => {
      const currentIds = current[groupId] ?? [];
      if (selectionType === "single") {
        return { ...current, [groupId]: currentIds.includes(optionId) ? [] : [optionId] };
      }
      if (currentIds.includes(optionId)) {
        return { ...current, [groupId]: currentIds.filter((id) => id !== optionId) };
      }
      const max = maxSelect ?? Infinity;
      if (currentIds.length >= max) return current;
      return { ...current, [groupId]: [...currentIds, optionId] };
    });
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-cocoa/50 px-3 py-3 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-[28px] bg-background shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4">
          <button onClick={onClose} aria-label="Retour" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border bg-card hover:bg-accent"><ArrowLeft className="h-5 w-5" /></button>
          <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
        </div>
        <div className="max-h-[75vh] overflow-y-auto">
          <div className="relative mx-4 h-[220px] overflow-hidden rounded-[24px] bg-muted sm:h-[280px]">
            {item.image ? <img src={item.image} alt={item.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Aucune image</div>}
            {promotion && (
              <span className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-primary-foreground shadow-sm">
                {getPromotionBadgeLabel(promotion)}
              </span>
            )}
          </div>
          <div className="space-y-4 px-5 py-5">
            <div>
              {item.subtitle ? <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">{item.subtitle}</p> : null}
              <h2 className="mt-1 font-display text-[28px] font-semibold leading-tight text-foreground">{item.name}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{item.description}</p>
            </div>
            {!item.available && (
              <span className="inline-block rounded-full bg-muted px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Indisponible pour le moment</span>
            )}
            <div className="flex items-center justify-between">
              {hasPriceDiscount ? (
                <span className="flex items-baseline gap-2">
                  <span className="text-[21px] font-bold text-primary">{unitPrice.toLocaleString("fr-FR")} FCFA</span>
                  <span className="text-sm text-muted-foreground line-through">{item.price!.toLocaleString("fr-FR")} FCFA</span>
                </span>
              ) : (
                <span className="text-[21px] font-bold text-primary">{item.price === null ? "À confirmer" : `${unitPrice.toLocaleString("fr-FR")} FCFA`}</span>
              )}
              {prepTimeLabel && <span className="text-sm font-medium text-muted-foreground">{prepTimeLabel}</span>}
            </div>

            {optionGroups.length > 0 && (
              <div className="space-y-4">
                {optionGroups.map((group) => {
                  const selectedIds = selected[group.id] ?? [];
                  const isSatisfied = !group.is_required || selectedIds.length >= Math.max(group.min_select, 1);
                  return (
                    <div key={group.id} className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">
                          {group.name}
                          {group.is_required ? (
                            <span className="ml-1.5 text-xs font-medium text-destructive">Obligatoire</span>
                          ) : (
                            <span className="ml-1.5 text-xs font-medium text-muted-foreground">Optionnel</span>
                          )}
                        </p>
                        {group.selection_type === "multiple" && group.max_select && (
                          <span className="shrink-0 text-xs text-muted-foreground">Max {group.max_select}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {group.options.map((option) => {
                          const isSelected = selectedIds.includes(option.id);
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => toggleOption(group.id, option.id, group.selection_type, group.max_select)}
                              className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                                isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent"
                              }`}
                            >
                              {option.name}
                              {option.extra_price > 0 && <span className="ml-1 opacity-80">+{option.extra_price.toLocaleString("fr-FR")} FCFA</span>}
                            </button>
                          );
                        })}
                      </div>
                      {!isSatisfied && <p className="text-xs font-medium text-destructive">Sélection requise</p>}
                    </div>
                  );
                })}
              </div>
            )}

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
          </div>
        </div>
        <div className="border-t border-border px-5 py-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-muted-foreground">Total</span>
            <span className="text-lg font-bold text-foreground">{total.toLocaleString("fr-FR")} FCFA</span>
          </div>
          <button
            onClick={() => {
              // Cart display only -- the server independently recomputes the
              // real charge from product_id + option_ids via
              // get_active_promotion/product_options, so baking the
              // discounted price and selected options into the cart item
              // here can never under/overcharge, it only keeps the cart
              // preview consistent with what create_order will actually total.
              onAdd(hasPriceDiscount ? { ...item, price: unitPrice } : item, qty, selectedFlat);
              onClose();
            }}
            disabled={!canAdd}
            className="mt-3 flex h-[58px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ShoppingCart className="h-5 w-5" />
            {!item.available ? "Indisponible" : !allRequiredSatisfied ? "Sélection requise" : "Ajouter au panier"}
          </button>
        </div>
      </div>
    </div>
  );
}

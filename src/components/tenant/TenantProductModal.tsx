import { useEffect, useState } from "react";
import { Minus, Plus, UtensilsCrossed } from "lucide-react";
import { formatPrice, type MenuItem } from "@/data/menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";

function ProductDetails({ item, qty, setQty }: { item: MenuItem; qty: number; setQty: (n: number) => void }) {
  return (
    <div className="flex flex-col">
      <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-muted">
        {item.image ? (
          <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <UtensilsCrossed className="h-14 w-14 text-muted-foreground/40" />
          </div>
        )}
      </div>
      <div className="mt-5">
        {item.subtitle && (
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">{item.subtitle}</p>
        )}
        <h2 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">{item.name}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
        {!item.available && (
          <span className="mt-3 inline-block rounded-full bg-muted px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Indisponible pour le moment
          </span>
        )}
        <div className="mt-5 flex items-center justify-between gap-4">
          <span className="font-display text-2xl font-semibold text-foreground">{formatPrice(item.price)}</span>
          <div className="flex items-center gap-3 rounded-full border border-border px-2 py-1">
            <button
              type="button"
              onClick={() => setQty(Math.max(1, qty - 1))}
              aria-label="Diminuer la quantité"
              className="grid h-9 w-9 place-items-center rounded-full hover:bg-accent disabled:opacity-40"
              disabled={qty <= 1}
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-6 text-center text-sm font-semibold">{qty}</span>
            <button
              type="button"
              onClick={() => setQty(qty + 1)}
              aria-label="Augmenter la quantité"
              className="grid h-9 w-9 place-items-center rounded-full hover:bg-accent"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TenantProductModal({
  item,
  onClose,
  onAdd,
}: {
  item: MenuItem | null;
  onClose: () => void;
  onAdd: (item: MenuItem, qty: number) => void;
}) {
  const isMobile = useIsMobile();
  const [qty, setQty] = useState(1);

  useEffect(() => {
    setQty(1);
  }, [item?.id]);

  if (!item) return null;

  const addLabel = item.available
    ? `Ajouter${qty > 1 ? ` ${qty}` : ""} au panier`
    : "Indisponible";

  const footer = (
    <button
      type="button"
      disabled={!item.available}
      onClick={() => {
        onAdd(item, qty);
        onClose();
      }}
      className="w-full rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
    >
      {addLabel}
    </button>
  );

  if (isMobile) {
    return (
      <Drawer open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <DrawerTitle className="sr-only">{item.name}</DrawerTitle>
          <div className="max-h-[75vh] overflow-y-auto pb-2 pt-2">
            <ProductDetails item={item} qty={qty} setQty={setQty} />
          </div>
          <div className="pt-3">{footer}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogTitle className="sr-only">{item.name}</DialogTitle>
        <ProductDetails item={item} qty={qty} setQty={setQty} />
        <div className="pt-2">{footer}</div>
      </DialogContent>
    </Dialog>
  );
}

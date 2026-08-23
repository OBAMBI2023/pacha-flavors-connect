import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Clock, Tag } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { MENU_BUCKET } from "@/lib/menu-db";
import { getOrCreateVisitorId } from "@/lib/visitorTracking";
import { fetchTenantOffers, markOfferRead, notifyOfferRead, trackOfferClick, type TenantOffer } from "@/lib/offers";
import { useCart } from "@/lib/cart";
import type { MenuItem } from "@/data/menu";

function money(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

function imageUrl(path: string | null): string | null {
  return path ? supabase.storage.from(MENU_BUCKET).getPublicUrl(path).data.publicUrl : null;
}

function endsLabel(iso: string | null): string | null {
  if (!iso) return null;
  const end = new Date(iso);
  const days = Math.ceil((end.getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return "Se termine aujourd'hui";
  if (days === 1) return "Se termine demain";
  return `Se termine le ${end.toLocaleDateString("fr-FR")}`;
}

export function TenantOffersSheet({
  slug,
  items,
  open,
  onOpenChange,
  openOfferId,
  onNeedsOptions,
}: {
  slug: string;
  /** Full storefront catalog, used to resolve an offer's product back into a cart-addable MenuItem. */
  items: MenuItem[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Set (e.g. from a notification tap) to jump straight into that offer's detail once the list loads, instead of showing the list first. */
  openOfferId?: string | null;
  /**
   * Called instead of adding directly when the claimed product has option
   * groups -- the picker must run through the page's single top-level
   * TenantProductModal (same one the regular menu uses), not a second
   * instance nested inside this sheet: a modal rendered inside an open
   * Radix Sheet inherits the sheet's `pointer-events: none` lockdown on
   * everything outside its own layer, which is exactly what made the
   * options unclickable before this fix.
   */
  onNeedsOptions: (item: MenuItem, offer: TenantOffer) => void;
}) {
  const { add, openCart, setActiveOfferId } = useCart();
  const [offers, setOffers] = useState<TenantOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<TenantOffer | null>(null);

  useEffect(() => {
    if (!open) return;
    setDetail(null);
    let cancelled = false;
    setLoading(true);
    fetchTenantOffers(slug, getOrCreateVisitorId())
      .then((rows) => {
        if (cancelled) return;
        setOffers(rows);
        const target = openOfferId ? rows.find((o) => o.id === openOfferId) : null;
        if (target) openDetail(target);
      })
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Impossible de charger les offres."))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, slug, openOfferId]);

  function openDetail(offer: TenantOffer) {
    setDetail(offer);
    if (!offer.is_read) {
      setOffers((prev) => prev.map((o) => (o.id === offer.id ? { ...o, is_read: true } : o)));
      void markOfferRead(offer.id, getOrCreateVisitorId()).then(notifyOfferRead);
    }
  }

  async function claim(offer: TenantOffer) {
    void trackOfferClick(offer.id);
    const menuItem = items.find((i) => i.id === offer.product_id);
    if (!menuItem) {
      toast.error("Ce plat n'est plus disponible sur la carte.");
      return;
    }
    // The offer price replaces the product's normal price/promotion for
    // display -- create_order independently re-applies the offer's price
    // server-side, this is only ever a preview.
    const offerItem: MenuItem = { ...menuItem, price: offer.offer_price, promotion: null };
    if ((menuItem.optionGroups?.length ?? 0) > 0) {
      // Required option groups must be chosen before adding to cart --
      // skipping straight to add() left the line with no option_ids,
      // which create_order's own required-group check then rejected. Hand
      // off to the page's shared product modal (see onNeedsOptions) and
      // close this sheet so nothing stays layered underneath it.
      onOpenChange(false);
      onNeedsOptions(offerItem, offer);
      return;
    }
    add(offerItem, 1, []);
    setActiveOfferId(offer.id);
    onOpenChange(false);
    openCart();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex h-[85vh] flex-col rounded-t-[20px] pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {detail ? (
          <>
            <SheetHeader className="flex-row items-center gap-2 space-y-0 text-left">
              <button onClick={() => setDetail(null)} aria-label="Retour" className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-accent">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <SheetTitle className="font-display text-xl">{detail.title}</SheetTitle>
            </SheetHeader>
            <div className="mt-4 flex-1 space-y-4 overflow-y-auto">
              <div className="aspect-video w-full overflow-hidden rounded-2xl bg-muted">
                {(imageUrl(detail.image_url) ?? imageUrl(detail.product_image_path)) ? (
                  <img src={imageUrl(detail.image_url) ?? imageUrl(detail.product_image_path)!} alt={detail.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center"><Tag className="h-10 w-10 text-muted-foreground/40" /></div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">-{detail.discount_percent}%</span>
                {endsLabel(detail.ends_at) && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" /> {endsLabel(detail.ends_at)}</span>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{detail.product_name}</p>
                {detail.description && <p className="mt-1 text-sm leading-relaxed">{detail.description}</p>}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-2xl font-semibold text-primary">{money(detail.offer_price)}</span>
                <span className="text-sm text-muted-foreground line-through">{money(detail.original_price)}</span>
              </div>
            </div>
            <Button size="lg" className="mt-4 w-full" onClick={() => void claim(detail)}>
              Profiter de l'offre
            </Button>
          </>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="font-display text-xl">Offres</SheetTitle>
            </SheetHeader>
            <div className="mt-4 flex-1 overflow-y-auto">
              {loading ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Chargement...</p>
              ) : offers.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-14 text-center">
                  <Tag className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Aucune offre en ce moment.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {offers.map((offer) => (
                    <button
                      key={offer.id}
                      onClick={() => openDetail(offer)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left shadow-sm"
                    >
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                        {(imageUrl(offer.image_url) ?? imageUrl(offer.product_image_path)) ? (
                          <img src={imageUrl(offer.image_url) ?? imageUrl(offer.product_image_path)!} alt={offer.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full w-full place-items-center"><Tag className="h-6 w-6 text-muted-foreground/40" /></div>
                        )}
                        {!offer.is_read && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{offer.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{offer.product_name}</p>
                        <div className="mt-1 flex items-baseline gap-1.5">
                          <span className="text-sm font-bold text-primary">{money(offer.offer_price)}</span>
                          <span className="text-xs text-muted-foreground line-through">{money(offer.original_price)}</span>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[0.7rem] font-bold text-primary">-{offer.discount_percent}%</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

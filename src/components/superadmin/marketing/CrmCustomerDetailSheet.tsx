import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MessageCircle, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  fetchCustomer,
  fetchCustomerOrderHistory,
  updateCustomerTags,
  type Customer,
  type CustomerOrderSummary,
} from "@/lib/customers-db";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp";
import { STATUS_LABELS } from "@/components/admin/orders/orderStatusMeta";
import type { OrderStatus } from "@/lib/orders-db";
import { formatMoney as money } from "@/lib/currency";
import {
  CAMPAIGN_STATUS_LABELS,
  CUSTOMER_CRM_SEGMENT_BADGE_CLASS,
  CUSTOMER_CRM_SEGMENT_LABELS,
  CUSTOMER_LIFECYCLE_BADGE_CLASS,
  CUSTOMER_LIFECYCLE_LABELS,
  customerCrmSegment,
  customerLifecycleStatus,
  fetchCustomerCampaignHistory,
  fetchCustomerFavoriteProducts,
  fetchCustomerFrequentedRestaurants,
  type CustomerCampaignHistoryRow,
  type FavoriteProduct,
  type FrequentedRestaurant,
} from "@/lib/marketing";

export function CrmCustomerDetailSheet({
  customerId,
  currency,
  onClose,
}: {
  customerId: string | null;
  currency: string;
  onClose: () => void;
}) {
  const isMobile = useIsMobile();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [history, setHistory] = useState<CustomerOrderSummary[]>([]);
  const [favorites, setFavorites] = useState<FavoriteProduct[]>([]);
  const [frequented, setFrequented] = useState<FrequentedRestaurant[]>([]);
  const [campaignHistory, setCampaignHistory] = useState<CustomerCampaignHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [savingTags, setSavingTags] = useState(false);

  useEffect(() => {
    if (!customerId) {
      setCustomer(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchCustomer(customerId)
      .then(async (c) => {
        if (cancelled || !c) return;
        setCustomer(c);
        const [historyData, favoritesData, campaignData, frequentedData] = await Promise.all([
          fetchCustomerOrderHistory(customerId),
          fetchCustomerFavoriteProducts(customerId),
          fetchCustomerCampaignHistory(customerId),
          fetchCustomerFrequentedRestaurants(c.phone, c.restaurant_id),
        ]);
        if (cancelled) return;
        setHistory(historyData);
        setFavorites(favoritesData);
        setCampaignHistory(campaignData);
        setFrequented(frequentedData);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Impossible de charger ce client.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  async function addTag() {
    if (!customer || !tagDraft.trim()) return;
    const next = Array.from(new Set([...customer.tags, tagDraft.trim()]));
    setSavingTags(true);
    try {
      await updateCustomerTags(customer.id, next);
      setCustomer({ ...customer, tags: next });
      setTagDraft("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'ajouter ce tag.");
    } finally {
      setSavingTags(false);
    }
  }

  async function removeTag(tag: string) {
    if (!customer) return;
    const next = customer.tags.filter((t) => t !== tag);
    setSavingTags(true);
    try {
      await updateCustomerTags(customer.id, next);
      setCustomer({ ...customer, tags: next });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de retirer ce tag.");
    } finally {
      setSavingTags(false);
    }
  }

  const wa = customer ? normalizeWhatsAppPhone(customer.phone) : null;
  const avgBasket =
    customer && customer.orders_count > 0 ? customer.total_spent / customer.orders_count : 0;
  const segment = customer ? customerCrmSegment(customer) : null;
  const lifecycle = customer ? customerLifecycleStatus(customer) : null;

  return (
    <Sheet open={Boolean(customerId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={
          isMobile ? "h-[92vh] overflow-y-auto rounded-t-2xl" : "w-full overflow-y-auto sm:max-w-lg"
        }
      >
        {loading && (
          <div className="space-y-4 pt-6">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
        {error && <p className="pt-6 text-sm text-destructive">{error}</p>}
        {customer && segment && lifecycle && (
          <>
            <SheetHeader>
              <SheetTitle className="flex flex-wrap items-center gap-2">
                {customer.full_name}
                <Badge className={CUSTOMER_CRM_SEGMENT_BADGE_CLASS[segment]}>
                  {CUSTOMER_CRM_SEGMENT_LABELS[segment]}
                </Badge>
                <Badge className={CUSTOMER_LIFECYCLE_BADGE_CLASS[lifecycle]}>
                  {CUSTOMER_LIFECYCLE_LABELS[lifecycle]}
                </Badge>
              </SheetTitle>
              <SheetDescription>
                Client depuis le {new Date(customer.created_at).toLocaleDateString("fr-FR")}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-5 space-y-6 text-sm">
              <section className="space-y-1.5 rounded-2xl border border-border p-4">
                <h3 className="font-semibold">Profil</h3>
                <p className="text-muted-foreground">{customer.phone}</p>
                <p className="text-muted-foreground">{customer.email ?? "Email non renseigné"}</p>
                <p className="text-muted-foreground">
                  {customer.address ?? "Adresse non renseignée"}
                </p>
                {customer.internal_note && (
                  <p className="mt-2 rounded-xl bg-muted/60 p-2.5 text-foreground">
                    <span className="font-medium">Note : </span>
                    {customer.internal_note}
                  </p>
                )}
                {wa && (
                  <a
                    href={`https://api.whatsapp.com/send/?phone=${wa}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                  >
                    <MessageCircle className="h-4 w-4" /> Ouvrir WhatsApp
                  </a>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="font-semibold">Tags</h3>
                <div className="flex flex-wrap gap-1.5">
                  {customer.tags.map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => void removeTag(tag)}
                        aria-label={`Retirer ${tag}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {customer.tags.length === 0 && (
                    <span className="text-xs text-muted-foreground">Aucun tag.</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void addTag();
                      }
                    }}
                    placeholder="Ajouter un tag (ex: allergique)"
                    className="h-9"
                    disabled={savingTags}
                  />
                </div>
              </section>

              <section className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-border p-3">
                  <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                    Commandes
                  </p>
                  <p className="mt-1 font-display text-xl font-semibold">{customer.orders_count}</p>
                </div>
                <div className="rounded-2xl border border-border p-3">
                  <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                    Total dépensé
                  </p>
                  <p className="mt-1 font-display text-lg font-semibold">
                    {money(customer.total_spent, currency)}
                  </p>
                </div>
                <div className="rounded-2xl border border-border p-3">
                  <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                    Panier moyen
                  </p>
                  <p className="mt-1 font-display text-lg font-semibold">
                    {money(avgBasket, currency)}
                  </p>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="font-semibold">Produits favoris</h3>
                {favorites.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Pas encore de commande.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {favorites.map((f) => (
                      <li
                        key={f.name}
                        className="flex items-center justify-between rounded-xl border border-border px-3 py-2"
                      >
                        <span>{f.name}</span>
                        <span className="font-semibold text-muted-foreground">×{f.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {frequented.length > 0 && (
                <section className="space-y-2">
                  <h3 className="font-semibold">Autres restaurants fréquentés</h3>
                  <ul className="space-y-1.5">
                    {frequented.map((r) => (
                      <li
                        key={r.restaurantId}
                        className="flex items-center justify-between rounded-xl border border-border px-3 py-2"
                      >
                        <span>{r.restaurantName}</span>
                        <span className="text-xs text-muted-foreground">
                          {r.ordersCount} commande{r.ordersCount > 1 ? "s" : ""} ·{" "}
                          {money(r.totalSpent, currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="space-y-2">
                <h3 className="font-semibold">Campagnes reçues</h3>
                {campaignHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucune campagne reçue pour le moment.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {campaignHistory.map((c) => (
                      <li key={c.campaignId} className="rounded-xl border border-border px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{c.campaignName}</span>
                          <Badge variant="outline">
                            {CAMPAIGN_STATUS_LABELS[c.campaignStatus]}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {c.recipientStatus === "sent"
                            ? "Envoyé"
                            : c.recipientStatus === "excluded"
                              ? "Exclu"
                              : "En attente"}
                          {c.converted && (
                            <span className="ml-1.5 font-semibold text-emerald-700">
                              · Convertie ✓
                            </span>
                          )}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="font-semibold">Historique des commandes</h3>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune commande pour le moment.</p>
                ) : (
                  <ul className="space-y-2">
                    {history.map((order) => (
                      <li key={order.id} className="rounded-2xl border border-border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">#{order.order_number}</span>
                          <Badge variant="outline">
                            {STATUS_LABELS[order.status as OrderStatus] ?? order.status}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {new Date(order.created_at).toLocaleString("fr-FR")} ·{" "}
                            {order.items_summary}
                          </span>
                          <span className="font-semibold text-foreground">
                            {money(order.total_amount, order.currency)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
